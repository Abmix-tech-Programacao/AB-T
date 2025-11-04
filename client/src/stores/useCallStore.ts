import { create } from 'zustand';
import { Transcript, Favorite } from '@shared/schema';

interface CallState {
  // Call management
  callState: 'IDLE' | 'RINGING' | 'CONNECTED' | 'ENDED';
  currentCallId: string | null;
  recordingSid: string | null;
  voiceType: string;
  aiActive: boolean;
  latency: number;
  audioLevel: number;
  phoneNumber: string;
  
  // Transcripts
  transcripts: Transcript[];
  
  // Favorites
  favorites: Favorite[];
  
  // UI states
  isRecording: boolean;
  livePrompt: string;
  selectedProvider: string;
  activeView: 'discagem' | 'vozes' | 'enhancer' | 'audio' | 'chamadas' | 'favoritos' | 'gravacoes' | 'configuracoes';
  
  // Actions
  setCallState: (state: 'IDLE' | 'RINGING' | 'CONNECTED' | 'ENDED') => void;
  setCurrentCallId: (callId: string | null) => void;
  setRecordingSid: (sid: string | null) => void;
  setVoiceType: (type: string) => void;
  setAiActive: (active: boolean) => void;
  setLatency: (latency: number) => void;
  setAudioLevel: (level: number) => void;
  setPhoneNumber: (number: string) => void;
  appendToPhoneNumber: (digit: string) => void;
  clearPhoneNumber: () => void;
  addTranscript: (transcript: Transcript) => void;
  updateTranscript: (id: string, updates: Partial<Transcript>) => void;
  clearTranscripts: () => void;
  setFavorites: (favorites: Favorite[]) => void;
  setIsRecording: (recording: boolean) => void;
  setLivePrompt: (prompt: string) => void;
  setSelectedProvider: (provider: string) => void;
  setActiveView: (view: 'discagem' | 'vozes' | 'enhancer' | 'audio' | 'chamadas' | 'favoritos' | 'gravacoes' | 'configuracoes') => void;
}

export const useCallStore = create<CallState>((set, get) => ({
  // Initial state
  callState: 'IDLE',
  currentCallId: null,
  recordingSid: null,
  voiceType: 'masc',
  aiActive: false,
  latency: 0,
  audioLevel: 0,
  phoneNumber: '',
  transcripts: [],
  favorites: [],
  isRecording: false,
  livePrompt: '',
  selectedProvider: 'falevono',
  activeView: 'discagem',
  
  // Actions
  setCallState: (state) => set({ callState: state }),
  setCurrentCallId: (callId) => set({ currentCallId: callId }),
  setRecordingSid: (sid) => set({ recordingSid: sid }),
  setVoiceType: (type) => set({ voiceType: type }),
  setAiActive: (active) => set({ aiActive: active }),
  setLatency: (latency) => set({ latency }),
  setAudioLevel: (level) => set({ audioLevel: level }),
  setPhoneNumber: (number) => set({ phoneNumber: number }),
  appendToPhoneNumber: (digit) => set(state => ({ 
    phoneNumber: state.phoneNumber + digit 
  })),
  clearPhoneNumber: () => set({ phoneNumber: '' }),
  
  addTranscript: (transcript) => set(state => ({
    transcripts: [...state.transcripts, transcript]
  })),
  
  updateTranscript: (id, updates) => set(state => ({
    transcripts: state.transcripts.map(t => 
      t.id === id ? { ...t, ...updates } : t
    )
  })),
  
  clearTranscripts: () => set({ transcripts: [] }),
  setFavorites: (favorites) => set({ favorites }),
  setIsRecording: (recording) => set({ isRecording: recording }),
  setLivePrompt: (prompt) => set({ livePrompt: prompt }),
  setSelectedProvider: (provider) => set({ selectedProvider: provider }),
  setActiveView: (view) => set({ activeView: view }),
}));
