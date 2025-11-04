import { VoiceProvider, CallEvent } from './voiceProvider';
import twilio from 'twilio';

export class TwilioProvider implements VoiceProvider {
  private accountSid: string;
  private authToken: string;
  private twimlAppSid: string;
  private twilioClient: twilio.Twilio;

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID || "";
    this.authToken = process.env.TWILIO_AUTH_TOKEN || "";
    this.twimlAppSid = process.env.TWILIO_TWIML_APP_SID || "";
    this.twilioClient = twilio(this.accountSid, this.authToken);
  }

  async startCall(toNumber: string, voiceId?: string): Promise<{ callId: string; status: string }> {
    try {
      const call = await this.twilioClient.calls.create({
        to: toNumber,
        from: process.env.TWILIO_NUMBER!,
        url: `https://${process.env.REPLIT_DEV_DOMAIN}/twiml?voiceType=${voiceId || 'masc'}`,
        record: false
      });

      console.log(`[TWILIO_PROVIDER] Call started: ${call.sid}`);
      return { callId: call.sid, status: call.status };
    } catch (error) {
      console.error('[TWILIO_PROVIDER] Error starting call:', error);
      throw error;
    }
  }

  async hangup(callId: string): Promise<boolean> {
    try {
      await this.twilioClient.calls(callId).update({ status: 'completed' });
      console.log(`[TWILIO_PROVIDER] Call ${callId} hung up`);
      return true;
    } catch (error) {
      console.error('[TWILIO_PROVIDER] Error hanging up call:', error);
      return false;
    }
  }

  async pauseAI(callId: string): Promise<boolean> {
    try {
      // Mute the call to pause AI interaction
      await this.twilioClient.calls(callId).update({ 
        twiml: '<Response><Say voice="alice" language="pt-BR">IA pausada. Controle assumido pelo operador.</Say><Pause length="300"/></Response>' 
      });
      console.log(`[TWILIO_PROVIDER] AI paused for call ${callId}`);
      return true;
    } catch (error) {
      console.error('[TWILIO_PROVIDER] Error pausing AI:', error);
      return false;
    }
  }

  async resumeAI(callId: string): Promise<boolean> {
    try {
      // Resume AI control
      await this.twilioClient.calls(callId).update({ 
        twiml: '<Response><Say voice="alice" language="pt-BR">IA retomada. Assistente virtual ativo.</Say></Response>' 
      });
      console.log(`[TWILIO_PROVIDER] AI resumed for call ${callId}`);
      return true;
    } catch (error) {
      console.error('[TWILIO_PROVIDER] Error resuming AI:', error);
      return false;
    }
  }

  async injectPrompt(callId: string, prompt: string): Promise<boolean> {
    try {
      // Inject prompt via TTS
      await this.twilioClient.calls(callId).update({ 
        twiml: `<Response><Say voice="alice" language="pt-BR">${prompt}</Say></Response>` 
      });
      console.log(`[TWILIO_PROVIDER] Prompt injected for call ${callId}: ${prompt}`);
      return true;
    } catch (error) {
      console.error('[TWILIO_PROVIDER] Error injecting prompt:', error);
      return false;
    }
  }

  async transfer(callId: string, target: string): Promise<boolean> {
    try {
      await this.twilioClient.calls(callId).update({ 
        twiml: `<Response><Dial>${target}</Dial></Response>` 
      });
      console.log(`[TWILIO_PROVIDER] Call ${callId} transferred to ${target}`);
      return true;
    } catch (error) {
      console.error('[TWILIO_PROVIDER] Error transferring call:', error);
      return false;
    }
  }

  async hold(callId: string): Promise<boolean> {
    try {
      await this.twilioClient.calls(callId).update({ 
        twiml: '<Response><Say voice="alice" language="pt-BR">Chamada em espera. Por favor aguarde.</Say><Play loop="10">https://api.twilio.com/cowbell.mp3</Play></Response>' 
      });
      console.log(`[TWILIO_PROVIDER] Call ${callId} on hold`);
      return true;
    } catch (error) {
      console.error('[TWILIO_PROVIDER] Error putting call on hold:', error);
      return false;
    }
  }

  async resume(callId: string): Promise<boolean> {
    try {
      await this.twilioClient.calls(callId).update({ 
        twiml: '<Response><Say voice="alice" language="pt-BR">Chamada retomada. Como posso ajudá-lo?</Say></Response>' 
      });
      console.log(`[TWILIO_PROVIDER] Call ${callId} resumed`);
      return true;
    } catch (error) {
      console.error('[TWILIO_PROVIDER] Error resuming call:', error);
      return false;
    }
  }

  async sendDTMF(callId: string, tone: string): Promise<boolean> {
    try {
      await this.twilioClient.calls(callId).update({ 
        twiml: `<Response><Play digits="${tone}"/></Response>`
      });
      console.log(`[TWILIO_PROVIDER] DTMF ${tone} sent to call ${callId}`);
      return true;
    } catch (error) {
      console.error('[TWILIO_PROVIDER] Error sending DTMF:', error);
      return false;
    }
  }
}
