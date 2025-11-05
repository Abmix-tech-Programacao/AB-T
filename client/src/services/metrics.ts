// Real-time metrics service using Server-Sent Events
let eventSource: EventSource | null = null;

interface MetricsData {
  latencyMs: number;
  timestamp: number;
  activeConnections: number;
}

type MetricsCallback = (data: MetricsData) => void;

export const metricsService = {
  connect(callback: MetricsCallback) {
    if (eventSource) {
      this.disconnect();
    }

    eventSource = new EventSource('/api/metrics');
    
    eventSource.onmessage = (event) => {
      try {
        const data: MetricsData = JSON.parse(event.data);
        callback(data);
      } catch (error) {
        console.error('[METRICS] Error parsing metrics data:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('[METRICS] EventSource error:', error);
      // Reconnect after 5 seconds
      setTimeout(() => {
        if (eventSource?.readyState === EventSource.CLOSED) {
          this.connect(callback);
        }
      }, 5000);
    };

    console.log('[METRICS] Connected to metrics stream');
  },

  disconnect() {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
      console.log('[METRICS] Disconnected from metrics stream');
    }
  }
};