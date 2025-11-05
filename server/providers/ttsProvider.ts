export class TTSProvider {
  private apiKey: string;
  private provider: 'elevenlabs' | 'playht';

  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY || process.env.PLAYHT_API_KEY || "";
    this.provider = process.env.ELEVENLABS_API_KEY ? 'elevenlabs' : 'playht';
  }

  async speak(text: string, voiceId: string): Promise<string | ReadableStream> {
    // TODO: Generate speech from text
    // Return audio stream or URL for integration with voice provider
    throw new Error('TTS provider not implemented yet');
  }

  async getVoices(): Promise<Array<{ id: string; name: string; language: string }>> {
    // TODO: Get available PT-BR voices
    throw new Error('TTS provider not implemented yet');
  }
}
