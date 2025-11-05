// Caption WebSocket service for real-time transcription
let ws: WebSocket | null = null;
const WS_URL = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/captions`;

export function connectCaptions() {
  if (ws) return;
  
  console.log('captions: connecting to', WS_URL);
  ws = new WebSocket(WS_URL);
  
  ws.onopen = () => {
    console.log('captions: open');
  };
  
  ws.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data);
      // Update captions card with JSON {text, isFinal}
      const event = new CustomEvent('captionReceived', { detail: data });
      window.dispatchEvent(event);
    } catch (error) {
      console.error('captions: parse error', error);
    }
  };
  
  ws.onerror = (error) => {
    console.log('captions: error', error);
    ws?.close();
  };
  
  ws.onclose = () => {
    ws = null;
    console.log('captions: closed');
    
    // Reconnect only if call is active
    setTimeout(() => {
      if ((window as any).__CALL_ACTIVE__) {
        connectCaptions();
      }
    }, 2000);
  };
}

export function disconnectCaptions() {
  try {
    ws?.close();
  } finally {
    ws = null;
  }
}

// Legacy compatibility
export const captionService = {
  onCaption: (callback: (caption: { text: string; isFinal: boolean }) => void) => {
    const handler = (event: any) => callback(event.detail);
    window.addEventListener('captionReceived', handler);
    return () => window.removeEventListener('captionReceived', handler);
  },
  disconnect: disconnectCaptions,
  isConnected: () => ws?.readyState === WebSocket.OPEN || false
};