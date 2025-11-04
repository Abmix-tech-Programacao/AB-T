export interface VoiceProvider {
  startCall(toNumber: string, voiceId?: string): Promise<{ callId: string; status: string }>;
  hangup(callId: string): Promise<boolean>;
  pauseAI(callId: string): Promise<boolean>;
  resumeAI(callId: string): Promise<boolean>;
  injectPrompt(callId: string, prompt: string): Promise<boolean>;
  transfer(callId: string, target: string): Promise<boolean>;
  hold(callId: string): Promise<boolean>;
  resume(callId: string): Promise<boolean>;
  sendDTMF(callId: string, tone: string): Promise<boolean>;
}

export interface CallEvent {
  type: 'call:state' | 'transcript:partial' | 'transcript:final' | 'agent:reply' | 'latency:update' | 'error';
  callId: string;
  payload: any;
}
