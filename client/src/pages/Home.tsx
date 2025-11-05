import { useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { websocketService } from '@/services/websocket';

export default function Home() {
  useEffect(() => {
    // Connect to WebSocket on component mount
    // websocketService.connect(); // DISABLED - Use captions service for call-specific connections

    // Cleanup on unmount
    return () => {
      websocketService.disconnect();
    };
  }, []);

  return <Layout />;
}
