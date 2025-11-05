import WebSocket from 'ws';
import { EventEmitter } from 'events';

export class STTProvider extends EventEmitter {
  private apiKey: string;
  private connections = new Map<string, WebSocket>();

  constructor() {
    super();
    this.apiKey = process.env.DEEPGRAM_API_KEY || process.env.DEEPGRAM_KEY || "";
  }

  async startStreaming(callId: string): Promise<void> {
    try {
      if (!this.apiKey) {
        throw new Error('Deepgram API key not configured');
      }

      const deepgramWs = new WebSocket('wss://api.deepgram.com/v1/listen', {
        headers: {
          'Authorization': `Token ${this.apiKey}`
        }
      });

      const config = {
        model: 'nova-2',
        language: 'pt-BR',
        smart_format: true,
        punctuate: true,
        interim_results: true,
        endpointing: 300,
        utterance_end_ms: 1000
      };

      deepgramWs.on('open', () => {
        console.log(`[STT_PROVIDER] Connected to Deepgram for call ${callId}`);
        deepgramWs.send(JSON.stringify(config));
        this.emit('stt-connected', callId);
      });

      deepgramWs.on('message', (data) => {
        try {
          const response = JSON.parse(data.toString());
          
          if (response.channel?.alternatives?.[0]?.transcript) {
            const transcript = response.channel.alternatives[0].transcript;
            const isFinal = response.is_final;
            
            console.log(`[STT_PROVIDER] Transcript (${isFinal ? 'final' : 'interim'}): ${transcript}`);
            
            this.emit('transcript', {
              callId,
              transcript,
              isFinal,
              timestamp: new Date()
            });
          }
        } catch (error) {
          console.error('[STT_PROVIDER] Error parsing Deepgram response:', error);
        }
      });

      deepgramWs.on('error', (error) => {
        console.error(`[STT_PROVIDER] Deepgram error for call ${callId}:`, error);
        this.emit('stt-error', callId, error);
      });

      deepgramWs.on('close', () => {
        console.log(`[STT_PROVIDER] Deepgram connection closed for call ${callId}`);
        this.connections.delete(callId);
        this.emit('stt-closed', callId);
      });

      this.connections.set(callId, deepgramWs);
      
    } catch (error) {
      console.error('[STT_PROVIDER] Failed to start streaming:', error);
      throw error;
    }
  }

  async stopStreaming(callId: string): Promise<void> {
    const connection = this.connections.get(callId);
    if (connection) {
      connection.close();
      this.connections.delete(callId);
      console.log(`[STT_PROVIDER] Stopped streaming for call ${callId}`);
    }
  }

  // Send audio data to Deepgram
  sendAudio(callId: string, audioData: Buffer): void {
    const connection = this.connections.get(callId);
    if (connection && connection.readyState === WebSocket.OPEN) {
      connection.send(audioData);
    }
  }

  // Send keepalive
  sendKeepAlive(callId: string): void {
    const connection = this.connections.get(callId);
    if (connection && connection.readyState === WebSocket.OPEN) {
      connection.send(JSON.stringify({ type: 'KeepAlive' }));
    }
  }
}
