// Load environment variables
import { config } from "dotenv";
config();

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { queries } from './database';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

interface RealtimeVoiceSession {
  callSid: string;
  voiceType: 'masc' | 'fem';
  sttWs: WebSocket | null;  // Speech-to-Text WebSocket
  ttsWs: WebSocket | null;  // Text-to-Speech WebSocket
  isConnected: boolean;
  enabled: boolean;
  lastActivity: number;
}

class RealtimeVoiceService extends EventEmitter {
  private sessions = new Map<string, RealtimeVoiceSession>();
  private latencyMetrics: number[] = [];

  constructor() {
    super();
    this.setupCleanupInterval();
  }

  // Get voice configuration
  private getVoiceConfig(voiceType: 'masc' | 'fem') {
    const voiceIdKey = voiceType === 'masc' ? 'VOZ_MASC_ID' : 'VOZ_FEM_ID';
    const voiceIdResult = queries.getSetting.get(voiceIdKey) as { value: string } | undefined;
    
    const defaultVoices = {
      masc: 'pNInz6obpgDQGcFmaJgB', // Adam - voz masculina natural
      fem: 'EXAVITQu4vr4xnSDxMaL'   // Bella - voz feminina natural
    };
    
    return voiceIdResult?.value || defaultVoices[voiceType];
  }

  // Start real-time voice conversion session
  async startRealtimeVoice(callSid: string, voiceType: 'masc' | 'fem'): Promise<boolean> {
    try {
      const targetVoiceId = this.getVoiceConfig(voiceType);
      
      console.log(`[REALTIME_VOICE] Starting session ${callSid} with voice ${targetVoiceId}`);

      // Start STT session for incoming audio
      const sttWs = new WebSocket('wss://api.elevenlabs.io/v1/speech-to-text/stream', {
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY
        }
      });

      // Start TTS session for outgoing audio
      const ttsWs = new WebSocket(`wss://api.elevenlabs.io/v1/text-to-speech/${targetVoiceId}/stream-input?model_id=eleven_multilingual_v2`, {
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY
        }
      });

      const session: RealtimeVoiceSession = {
        callSid,
        voiceType,
        sttWs,
        ttsWs,
        isConnected: false,
        enabled: true,
        lastActivity: Date.now()
      };

      // Setup STT WebSocket (Speech-to-Text)
      sttWs.on('open', () => {
        console.log(`[REALTIME_VOICE] STT connected for ${callSid}`);
        
        // Configure STT for Portuguese
        sttWs.send(JSON.stringify({
          language: 'pt',
          model: 'whisper-large-v3',
          optimize_streaming_latency: 1
        }));
      });

      sttWs.on('message', (data) => {
        try {
          const result = JSON.parse(data.toString());
          
          if (result.text && result.is_final && session.enabled) {
            console.log(`[REALTIME_VOICE] STT Result: "${result.text}"`);
            
            // Send transcribed text to TTS for voice conversion
            this.convertTextToTargetVoice(callSid, result.text);
          }
        } catch (error) {
          console.error('[REALTIME_VOICE] STT parse error:', error);
        }
      });

      // Setup TTS WebSocket (Text-to-Speech)
      ttsWs.on('open', () => {
        console.log(`[REALTIME_VOICE] TTS connected for ${callSid}`);
        
        // Configure TTS for optimal real-time performance
        ttsWs.send(JSON.stringify({
          text: " ",
          voice_settings: {
            stability: 0.35,
            similarity_boost: 0.85,
            style: 0.15,
            use_speaker_boost: true
          },
          generation_config: {
            chunk_length_schedule: [120, 160, 250, 290]
          },
          optimize_streaming_latency: 1,
          output_format: "pcm_8000" // Compatible with Twilio
        }));

        session.isConnected = true;
        this.emit('realtime-voice-ready', callSid);
      });

      ttsWs.on('message', (data) => {
        session.lastActivity = Date.now();
        
        try {
          const message = JSON.parse(data.toString());
          
          if (message.audio) {
            // Emit converted audio for Twilio
            this.emit('converted-voice-audio', callSid, Buffer.from(message.audio, 'base64'));
          }
        } catch (error) {
          console.error('[REALTIME_VOICE] TTS parse error:', error);
        }
      });

      // Error handling
      sttWs.on('error', (error) => {
        console.error(`[REALTIME_VOICE] STT error for ${callSid}:`, error);
      });

      ttsWs.on('error', (error) => {
        console.error(`[REALTIME_VOICE] TTS error for ${callSid}:`, error);
      });

      // Cleanup on close
      const cleanup = () => {
        console.log(`[REALTIME_VOICE] Session ${callSid} closed`);
        session.isConnected = false;
        this.sessions.delete(callSid);
        this.emit('realtime-voice-closed', callSid);
      };

      sttWs.on('close', cleanup);
      ttsWs.on('close', cleanup);

      this.sessions.set(callSid, session);
      return true;

    } catch (error) {
      console.error(`[REALTIME_VOICE] Failed to start session:`, error);
      return false;
    }
  }

  // Process incoming audio for STT
  processIncomingAudio(callSid: string, audioBase64: string): boolean {
    const session = this.sessions.get(callSid);
    
    if (!session || !session.sttWs || !session.enabled) {
      return false;
    }

    try {
      // Send audio to STT
      session.sttWs.send(JSON.stringify({
        audio: audioBase64
      }));

      session.lastActivity = Date.now();
      return true;

    } catch (error) {
      console.error(`[REALTIME_VOICE] Error processing audio:`, error);
      return false;
    }
  }

  // Convert text to target voice
  private convertTextToTargetVoice(callSid: string, text: string): boolean {
    const session = this.sessions.get(callSid);
    
    if (!session || !session.ttsWs || !session.enabled) {
      return false;
    }

    try {
      // Send text to TTS for voice conversion
      session.ttsWs.send(JSON.stringify({
        text: text,
        voice_settings: {
          stability: 0.35,
          similarity_boost: 0.85,
          style: 0.15,
          use_speaker_boost: true
        }
      }));

      return true;

    } catch (error) {
      console.error(`[REALTIME_VOICE] Error converting text:`, error);
      return false;
    }
  }

  // Enable/disable voice conversion
  setConversionEnabled(callSid: string, enabled: boolean): boolean {
    const session = this.sessions.get(callSid);
    
    if (!session) {
      console.warn(`[REALTIME_VOICE] Session ${callSid} not found`);
      return false;
    }

    session.enabled = enabled;
    console.log(`[REALTIME_VOICE] Session ${callSid} conversion ${enabled ? 'enabled' : 'disabled'}`);
    return true;
  }

  // Check if conversion is enabled
  isConversionEnabled(callSid: string): boolean {
    const session = this.sessions.get(callSid);
    return session ? session.enabled : false;
  }

  // Stop session
  stopRealtimeVoice(callSid: string): boolean {
    const session = this.sessions.get(callSid);
    
    if (session) {
      console.log(`[REALTIME_VOICE] Stopping session ${callSid}`);
      
      if (session.sttWs) session.sttWs.close();
      if (session.ttsWs) session.ttsWs.close();
      
      this.sessions.delete(callSid);
      return true;
    }
    return false;
  }

  // Get session statistics
  getSessionStats() {
    return {
      activeSessions: this.sessions.size,
      averageLatency: this.getAverageLatency(),
      sessions: Array.from(this.sessions.entries()).map(([id, session]) => ({
        id,
        voiceType: session.voiceType,
        isConnected: session.isConnected,
        enabled: session.enabled,
        lastActivity: session.lastActivity
      }))
    };
  }

  // Record latency metrics
  private recordLatency(latency: number): void {
    this.latencyMetrics.push(latency);
    
    if (this.latencyMetrics.length > 10) {
      this.latencyMetrics.shift();
    }
  }

  // Get average latency
  private getAverageLatency(): number {
    if (this.latencyMetrics.length === 0) return 0;
    
    const sum = this.latencyMetrics.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.latencyMetrics.length);
  }

  // Cleanup inactive sessions
  private setupCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now();
      const timeout = 300000; // 5 minutes
      
      for (const [callSid, session] of Array.from(this.sessions.entries())) {
        if (now - session.lastActivity > timeout) {
          console.log(`[REALTIME_VOICE] Cleaning up inactive session: ${callSid}`);
          this.stopRealtimeVoice(callSid);
        }
      }
    }, 60000); // Check every minute
  }
}

export const realtimeVoiceService = new RealtimeVoiceService();







