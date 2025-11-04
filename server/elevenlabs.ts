import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { queries } from './database';
import fetch from 'node-fetch';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_WS_URL = 'wss://api.elevenlabs.io/v1/text-to-speech';

interface ElevenLabsSession {
  ws: WebSocket | null;
  voiceId: string;
  model: string;
  isConnected: boolean;
  lastActivity: number;
}

class ElevenLabsService extends EventEmitter {
  private sessions = new Map<string, ElevenLabsSession>();
  private latencyMetrics: number[] = [];

  constructor() {
    super();
    this.setupCleanupInterval();
  }

  // Get voice configuration from database
  private getVoiceConfig(voiceType: 'masc' | 'fem') {
    const voiceIdKey = voiceType === 'masc' ? 'VOZ_MASC_ID' : 'VOZ_FEM_ID';
    const modelKey = 'MODELO';
    
    const voiceIdResult = queries.getSetting.get(voiceIdKey) as { value: string } | undefined;
    const modelResult = queries.getSetting.get(modelKey) as { value: string } | undefined;
    
    const voiceId = voiceIdResult?.value || 'pNInz6obpgDQGcFmaJgB';
    const model = modelResult?.value || 'eleven_multilingual_v2'; // Modelo mais natural
    
    return { voiceId, model };
  }

  // Start TTS session
  async startTTSSession(sessionId: string, voiceType: 'masc' | 'fem'): Promise<boolean> {
    try {
      const { voiceId, model } = this.getVoiceConfig(voiceType);
      
      console.log(`[ELEVENLABS] Starting TTS session ${sessionId} with voice ${voiceId}`);

      const ws = new WebSocket(`${ELEVENLABS_WS_URL}/${voiceId}/stream-input?model_id=${model}`, {
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY
        }
      });

      const session: ElevenLabsSession = {
        ws,
        voiceId,
        model,
        isConnected: false,
        lastActivity: Date.now()
      };

      ws.on('open', () => {
        console.log(`[ELEVENLABS] TTS session ${sessionId} connected`);
        session.isConnected = true;
        session.lastActivity = Date.now();
        
        // Configuração inicial otimizada para naturalidade
        ws.send(JSON.stringify({
          text: " ",
          voice_settings: {
            stability: 0.35,
            similarity_boost: 0.95,
            style: 0.15,
            use_speaker_boost: true
          },
          generation_config: {
            chunk_length_schedule: [120, 160, 250, 290]
          },
          optimize_streaming_latency: 0,
          // Alinha com Twilio Media Stream (8kHz μ-law/PCM)
          output_format: "pcm_8000"
        }));

        this.emit('tts-session-ready', sessionId);
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
            
            // Emit audio data for Twilio
            this.emit('tts-audio', sessionId, Buffer.from(message.audio, 'base64'));
          }
          
          if (message.isFinal) {
            console.log(`[ELEVENLABS] TTS final chunk for session ${sessionId}`);
          }
        } catch (error) {
          console.error(`[ELEVENLABS] Error parsing message:`, error);
        }
      });

      ws.on('error', (error) => {
        console.error(`[ELEVENLABS] TTS session ${sessionId} error:`, error);
        session.isConnected = false;
        this.emit('tts-session-error', sessionId, error);
      });

      ws.on('close', () => {
        console.log(`[ELEVENLABS] TTS session ${sessionId} closed`);
        session.isConnected = false;
        this.sessions.delete(sessionId);
        this.emit('tts-session-closed', sessionId);
      });

      this.sessions.set(sessionId, session);
      return true;

    } catch (error) {
      console.error(`[ELEVENLABS] Failed to start TTS session:`, error);
      return false;
    }
  }

  // Send text to TTS
  sendTTSText(sessionId: string, text: string, style?: string): boolean {
    const session = this.sessions.get(sessionId);
    
    if (!session || !session.isConnected || !session.ws) {
      console.warn(`[ELEVENLABS] TTS session ${sessionId} not available`);
      return false;
    }

    try {
      const voiceSettings: any = {
        stability: 0.5,
        similarity_boost: 0.8,
        use_speaker_boost: true
      };

      // Apply style if provided
      if (style) {
        switch (style) {
          case 'formal':
            voiceSettings.stability = 0.7;
            voiceSettings.style = 0.2;
            break;
          case 'simpatico':
            voiceSettings.stability = 0.3;
            voiceSettings.style = 0.8;
            break;
          default: // neutro
            voiceSettings.style = 0.0;
        }
      }

      session.ws.send(JSON.stringify({
        text: text,
        voice_settings: voiceSettings
      }));

      session.lastActivity = Date.now();
      return true;

    } catch (error) {
      console.error(`[ELEVENLABS] Error sending TTS text:`, error);
      return false;
    }
  }

  // Start STT session for captions
  async startSTTSession(): Promise<WebSocket | null> {
    try {
      console.log('[ELEVENLABS] Starting STT session for captions');
      
      const sttWs = new WebSocket('wss://api.elevenlabs.io/v1/speech-to-text/stream', {
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY
        }
      });

      sttWs.on('open', () => {
        console.log('[ELEVENLABS] STT session connected');
        
        // Send configuration
        sttWs.send(JSON.stringify({
          language: 'pt',
          model: 'whisper-large-v3'
        }));
      });

      sttWs.on('message', (data) => {
        try {
          const result = JSON.parse(data.toString());
          
          if (result.text) {
            this.emit('stt-transcript', {
              text: result.text,
              isFinal: result.is_final || false
            });
          }
        } catch (error) {
          console.error('[ELEVENLABS] STT parse error:', error);
        }
      });

      sttWs.on('error', (error) => {
        console.error('[ELEVENLABS] STT error:', error);
      });

      return sttWs;

    } catch (error) {
      console.error('[ELEVENLABS] Failed to start STT session:', error);
      return null;
    }
  }

  // Stop TTS session
  stopTTSSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    
    if (session && session.ws) {
      console.log(`[ELEVENLABS] Stopping TTS session ${sessionId}`);
      session.ws.close();
      this.sessions.delete(sessionId);
      return true;
    }
    return false;
  }

  // Get available voices from ElevenLabs
  async getVoices(): Promise<any[]> {
    try {
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY!
        }
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      const data: any = await response.json();
      return data.voices || [];

    } catch (error) {
      console.error('[ELEVENLABS] Failed to fetch voices:', error);
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
          console.log(`[ELEVENLABS] Cleaning up inactive session: ${sessionId}`);
          this.stopTTSSession(sessionId);
        }
      }
    }, 60000); // Check every minute
  }
}

export const elevenLabsService = new ElevenLabsService();