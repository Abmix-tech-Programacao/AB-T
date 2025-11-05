import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { queries } from './database';

// Load environment variables
import { config } from "dotenv";
config();

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_CONVERSION_URL = 'wss://api.elevenlabs.io/v1/text-to-speech';

interface VoiceConversionSession {
  ws: WebSocket | null;
  targetVoiceId: string;
  isConnected: boolean;
  lastActivity: number;
  enabled: boolean; // Se a conversão está ativa ou não
}

class VoiceConversionService extends EventEmitter {
  private sessions = new Map<string, VoiceConversionSession>();
  private latencyMetrics: number[] = [];

  constructor() {
    super();
    this.setupCleanupInterval();
  }

  // Get voice configuration from database
  private getTargetVoiceConfig(voiceType: 'masc' | 'fem') {
    const voiceIdKey = voiceType === 'masc' ? 'VOZ_MASC_ID' : 'VOZ_FEM_ID';
    
    const voiceIdResult = queries.getSetting.get(voiceIdKey) as { value: string } | undefined;
    
    // Default voice IDs for voice conversion (natural sounding voices)
    const defaultVoices = {
      masc: 'pNInz6obpgDQGcFmaJgB', // Adam - voz masculina natural
      fem: 'EXAVITQu4vr4xnSDxMaL'   // Bella - voz feminina natural
    };
    
    return voiceIdResult?.value || defaultVoices[voiceType];
  }

  // Start voice conversion session
  async startVoiceConversion(sessionId: string, targetVoiceType: 'masc' | 'fem'): Promise<boolean> {
    try {
      const targetVoiceId = this.getTargetVoiceConfig(targetVoiceType);
      
      console.log(`[VOICE_CONVERSION] Starting voice conversion session ${sessionId} to voice ${targetVoiceId}`);

      const ws = new WebSocket(`${ELEVENLABS_VOICE_CONVERSION_URL}?voice_id=${targetVoiceId}`, {
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY
        }
      });

      const session: VoiceConversionSession = {
        ws,
        targetVoiceId,
        isConnected: false,
        lastActivity: Date.now(),
        enabled: true // Por padrão, conversão ativa
      };

      ws.on('open', () => {
        console.log(`[VOICE_CONVERSION] Session ${sessionId} connected`);
        session.isConnected = true;
        session.lastActivity = Date.now();
        
        // Configuração inicial para conversão de voz em português
        ws.send(JSON.stringify({
          voice_settings: {
            stability: 0.35,
            similarity_boost: 0.85,
            style: 0.15,
            use_speaker_boost: true
          },
          generation_config: {
            chunk_length_schedule: [120, 160, 250, 290]
          },
          // Configurações específicas para conversão de voz
          optimize_streaming_latency: 1, // Prioriza latência baixa
          output_format: "pcm_8000", // Formato compatível com Twilio
          model_id: "eleven_multilingual_sts_v2" // Modelo específico para speech-to-speech
        }));

        this.emit('voice-conversion-ready', sessionId);
      });

      ws.on('message', (data) => {
        session.lastActivity = Date.now();
        const startTime = Date.now();
        
        try {
          const message = JSON.parse(data.toString());
          
          if (message.audio) {
            // Calculate latency
            const latency = Date.now() - startTime;
            this.recordLatency(latency);
            
            // Emit converted audio data
            this.emit('converted-audio', sessionId, Buffer.from(message.audio, 'base64'));
          }
          
          if (message.isFinal) {
            console.log(`[VOICE_CONVERSION] Final chunk for session ${sessionId}`);
          }
        } catch (error) {
          console.error(`[VOICE_CONVERSION] Error parsing message:`, error);
        }
      });

      ws.on('error', (error) => {
        console.error(`[VOICE_CONVERSION] Session ${sessionId} error:`, error);
        session.isConnected = false;
        this.emit('voice-conversion-error', sessionId, error);
      });

      ws.on('close', () => {
        console.log(`[VOICE_CONVERSION] Session ${sessionId} closed`);
        session.isConnected = false;
        this.sessions.delete(sessionId);
        this.emit('voice-conversion-closed', sessionId);
      });

      this.sessions.set(sessionId, session);
      return true;

    } catch (error) {
      console.error(`[VOICE_CONVERSION] Failed to start session:`, error);
      return false;
    }
  }

  // Process incoming audio for voice conversion
  processAudio(sessionId: string, audioBase64: string): boolean {
    const session = this.sessions.get(sessionId);
    
    if (!session || !session.isConnected || !session.ws || !session.enabled) {
      return false;
    }

    try {
      // Send audio data for conversion
      session.ws.send(JSON.stringify({
        audio: audioBase64
      }));

      session.lastActivity = Date.now();
      return true;

    } catch (error) {
      console.error(`[VOICE_CONVERSION] Error processing audio:`, error);
      return false;
    }
  }

  // Enable/disable voice conversion for a session
  setConversionEnabled(sessionId: string, enabled: boolean): boolean {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      console.warn(`[VOICE_CONVERSION] Session ${sessionId} not found`);
      return false;
    }

    session.enabled = enabled;
    console.log(`[VOICE_CONVERSION] Session ${sessionId} conversion ${enabled ? 'enabled' : 'disabled'}`);
    return true;
  }

  // Check if conversion is enabled for a session
  isConversionEnabled(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    return session ? session.enabled : false;
  }

  // Stop voice conversion session
  stopVoiceConversion(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    
    if (session && session.ws) {
      console.log(`[VOICE_CONVERSION] Stopping session ${sessionId}`);
      session.ws.close();
      this.sessions.delete(sessionId);
      return true;
    }
    return false;
  }

  // Get available voices for conversion
  async getAvailableVoices(): Promise<any[]> {
    try {
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY!
        }
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      const data = await response.json();
      // Filter voices suitable for real-time conversion
      return (data.voices || []).filter((voice: any) => 
        voice.category === 'premade' || voice.category === 'cloned'
      );

    } catch (error) {
      console.error('[VOICE_CONVERSION] Failed to fetch voices:', error);
      return [];
    }
  }

  // Record latency metrics
  private recordLatency(latency: number): void {
    this.latencyMetrics.push(latency);
    
    // Keep only last 10 measurements
    if (this.latencyMetrics.length > 10) {
      this.latencyMetrics.shift();
    }
  }

  // Get average latency
  getAverageLatency(): number {
    if (this.latencyMetrics.length === 0) return 0;
    
    const sum = this.latencyMetrics.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.latencyMetrics.length);
  }

  // Cleanup inactive sessions
  private setupCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now();
      const timeout = 300000; // 5 minutes
      
      for (const [sessionId, session] of Array.from(this.sessions.entries())) {
        if (now - session.lastActivity > timeout) {
          console.log(`[VOICE_CONVERSION] Cleaning up inactive session: ${sessionId}`);
          this.stopVoiceConversion(sessionId);
        }
      }
    }, 60000); // Check every minute
  }

  // Get session statistics
  getSessionStats() {
    return {
      activeSessions: this.sessions.size,
      averageLatency: this.getAverageLatency(),
      sessions: Array.from(this.sessions.entries()).map(([id, session]) => ({
        id,
        targetVoiceId: session.targetVoiceId,
        isConnected: session.isConnected,
        enabled: session.enabled,
        lastActivity: session.lastActivity
      }))
    };
  }
}

export const voiceConversionService = new VoiceConversionService();
