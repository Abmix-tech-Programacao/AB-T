import { useCallStore } from '@/stores/useCallStore';

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 3000;
  private isConnected = false;

  connect() {
    // DISABLED - This WebSocket service is disabled to prevent infinite loops
    // Use captions.ts service for call-specific connections instead
    console.log('[WEBSOCKET] Service disabled - use captions service for calls');
    return;

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.isConnected = false;
      this.attemptReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  private attemptReconnect() {
    // DISABLED - No more automatic reconnection to prevent loops
    console.log('[WEBSOCKET] Reconnection disabled - use captions service instead');
  }

  private handleMessage(data: any) {
    const store = useCallStore.getState();

    switch (data.type) {
      case 'connected':
        store.setSelectedProvider(data.payload.provider);
        break;

      case 'call:state':
        store.setCallState(data.payload.state);
        if (data.payload.state === 'ENDED') {
          store.setCurrentCallId(null);
          store.clearTranscripts();
        }
        break;

      case 'agent:state':
        store.setAiActive(data.payload.aiActive);
        break;

      case 'transcript:partial':
        // For partial transcripts, find existing and update or add new
        const existingPartial = store.transcripts.find(
          t => t.speaker === data.payload.speaker && !t.isFinal
        );
        
        if (existingPartial) {
          store.updateTranscript(existingPartial.id, {
            text: data.payload.text,
            timestamp: new Date(data.payload.timestamp),
          });
        } else {
          store.addTranscript({
            id: `partial-${Date.now()}`,
            callId: data.callId,
            speaker: data.payload.speaker,
            text: data.payload.text,
            timestamp: new Date(data.payload.timestamp),
            isFinal: false,
            confidence: data.payload.confidence || null,
          });
        }
        break;

      case 'transcript:final':
        // Remove any partial transcript and add final one
        const finalTranscript = {
          id: `final-${Date.now()}`,
          callId: data.callId,
          speaker: data.payload.speaker,
          text: data.payload.text,
          timestamp: new Date(data.payload.timestamp),
          isFinal: true,
          confidence: data.payload.confidence || null,
        };
        
        // Remove partial transcript for same speaker
        store.clearTranscripts();
        store.transcripts
          .filter(t => !(t.speaker === data.payload.speaker && !t.isFinal))
          .forEach(t => store.addTranscript(t));
        
        store.addTranscript(finalTranscript);
        break;

      case 'latency:update':
        store.setLatency(data.payload.latency);
        break;

      case 'audio:level':
        store.setAudioLevel(data.payload.level);
        break;

      case 'error':
        console.error('Call error:', data.payload);
        break;

      default:
        console.log('Unknown WebSocket message type:', data.type);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }

  getConnectionStatus() {
    return this.isConnected;
  }
}

export const websocketService = new WebSocketService();
