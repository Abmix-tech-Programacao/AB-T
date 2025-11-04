import { apiRequest } from '@/lib/queryClient';

export const api = {
  // === TELEPHONY ENDPOINTS ===
  
  startCall: async (provider: string, toNumber: string, voiceType: string = 'masc') => {
    const response = await apiRequest('POST', '/api/call/dial', {
      to: toNumber,
      voiceType,
    });
    return response.json();
  },

  hangupCall: async (callSid: string) => {
    const response = await apiRequest('POST', '/api/call/hangup', { callSid });
    return response.json();
  },

  sendDTMF: async (callSid: string, digits: string) => {
    const response = await apiRequest('POST', '/api/call/dtmf', { callSid, digits });
    return response.json();
  },

  answerCall: async (callSid: string) => {
    const response = await apiRequest('POST', '/api/call/answer', { callSid });
    return response.json();
  },

  // === RECORDING ENDPOINTS ===
  
  startRecording: async (callSid: string, phoneNumber?: string) => {
    const response = await apiRequest('POST', '/api/recordings/start', { 
      callSid,
      phoneNumber: phoneNumber || 'Unknown'
    });
    return response.json();
  },

  pauseRecording: async (recordingId: number) => {
    const response = await apiRequest('POST', `/api/recordings/${recordingId}/pause`);
    return response.json();
  },

  resumeRecording: async (recordingId: number) => {
    const response = await apiRequest('POST', `/api/recordings/${recordingId}/resume`);
    return response.json();
  },

  stopRecording: async (recordingId: number) => {
    const response = await apiRequest('POST', `/api/recordings/${recordingId}/stop`);
    return response.json();
  },

  getRecordings: async () => {
    const response = await apiRequest('GET', '/api/recordings/list');
    return response.json();
  },

  downloadRecording: async (id: string) => {
    const response = await fetch(`/api/recordings/${id}/download`);
    return response.blob();
  },

  deleteRecording: async (id: string) => {
    const response = await apiRequest('DELETE', `/api/recordings/${id}`);
    return response.json();
  },

  // === AI/AGENT ENDPOINTS ===
  
  injectPrompt: async (callSid: string, text: string) => {
    const response = await apiRequest('POST', '/api/agent/prompt', { text, callSid });
    return response.json();
  },

  pauseAI: async (callSid: string) => {
    const response = await apiRequest('POST', '/api/agent/disable', { callSid });
    return response.json();
  },

  resumeAI: async (callSid: string) => {
    const response = await apiRequest('POST', '/api/agent/enable', { callSid });
    return response.json();
  },

  // === VOICE/TTS ENDPOINTS ===
  
  getVoices: async () => {
    const response = await apiRequest('GET', '/api/voices');
    return response.json();
  },

  testVoice: async (voiceId: string, text: string) => {
    const response = await fetch('/api/voices/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voiceId, text })
    });
    return response;
  },

  // === FAVORITES ENDPOINTS ===
  
  getFavorites: async () => {
    const response = await apiRequest('GET', '/api/favorites');
    return response.json();
  },

  addFavorite: async (favorite: { name: string; phone_e164: string; voice_type?: 'masc' | 'fem' }) => {
    const response = await apiRequest('POST', '/api/favorites/add', favorite);
    return response.json();
  },

  removeFavorite: async (id: string) => {
    const response = await apiRequest('DELETE', `/api/favorites/${id}`);
    return response.json();
  },

  // === VOIP NUMBERS ENDPOINTS ===
  
  getVoipNumbers: async () => {
    const response = await apiRequest('GET', '/api/voip-numbers');
    return response.json();
  },

  getDefaultVoipNumber: async () => {
    const response = await apiRequest('GET', '/api/voip-numbers/default');
    return response.json();
  },

  addVoipNumber: async (data: { 
    name: string; 
    number: string; 
    provider: string; 
    sipUsername?: string; 
    sipPassword?: string; 
    sipServer?: string; 
    isDefault?: boolean;
  }) => {
    const response = await apiRequest('POST', '/api/voip-numbers', data);
    return response.json();
  },

  setDefaultVoipNumber: async (id: number) => {
    const response = await apiRequest('PUT', `/api/voip-numbers/${id}/default`, {});
    return response.json();
  },

  deleteVoipNumber: async (id: number) => {
    const response = await apiRequest('DELETE', `/api/voip-numbers/${id}`);
    return response.json();
  },

  // === SETTINGS ENDPOINTS ===
  
  getSettings: async () => {
    const response = await apiRequest('GET', '/api/settings');
    return response.json();
  },

  updateSettings: async (settings: Record<string, string>) => {
    const response = await apiRequest('POST', '/api/settings', settings);
    return response.json();
  },

  // === TRANSCRIPTS ENDPOINTS ===
  
  getTranscripts: async (callId: string) => {
    const response = await apiRequest('GET', `/api/transcripts/${callId}`);
    return response.json();
  },

  // === LEGACY COMPATIBILITY ===
  
  sendLivePrompt: async (text: string, style?: string) => {
    const response = await apiRequest('POST', '/api/agent/prompt', { text, style });
    return response.json();
  },
};