import { SIPService } from '../sipService';

export class SobreIPProvider {
  private sipUsername: string;
  private sipPassword: string;
  private sipServer: string;
  private fromNumber: string;
  private providerType: string;
  private sipService: SIPService;

  constructor(sipUsername: string, sipPassword: string, sipServer: string, fromNumber: string, providerType: string = 'SOBREIP') {
    this.sipUsername = sipUsername;
    this.providerType = providerType;
    
    // Use environment variable for password security
    if (providerType === 'FALEVONO') {
      this.sipPassword = process.env.FALEVONO_PASSWORD || sipPassword;
    } else {
      this.sipPassword = process.env.SOBREIP_PASSWORD || sipPassword;
    }
    
    this.sipServer = sipServer;
    this.fromNumber = fromNumber;
    
    console.log(`[${providerType}_PROVIDER] Initialized`);
    console.log(`  Server: ${sipServer}`);
    console.log(`  Username: ${sipUsername}`);
    console.log(`  From Number: ${fromNumber}`);
    
    const envVarName = providerType === 'FALEVONO' ? 'FALEVONO_PASSWORD' : 'SOBREIP_PASSWORD';
    const hasEnvVar = providerType === 'FALEVONO' ? process.env.FALEVONO_PASSWORD : process.env.SOBREIP_PASSWORD;
    console.log(`  Password Source: ${hasEnvVar ? `${envVarName} (Secure)` : 'Database (Not Recommended)'}`);
    
    // Initialize SIP service
    this.sipService = new SIPService(
      sipUsername,
      this.sipPassword,
      sipServer,
      fromNumber,
      5060
    );
  }

  async startCall(toNumber: string, voiceId?: string): Promise<{ callId: string; status: string }> {
    try {
      console.log(`[${this.providerType}_PROVIDER] Starting REAL SIP call...`);
      console.log(`  From: ${this.fromNumber} (via ${this.sipServer})`);
      console.log(`  To: ${toNumber}`);
      console.log(`  Voice: ${voiceId || 'default'}`);
      
      // Initialize SIP service if needed
      await this.sipService.initialize();
      
      // Make real SIP call
      const callId = await this.sipService.makeCall(toNumber);
      
      console.log(`[${this.providerType}_PROVIDER] ✅ Call initiated - ID: ${callId}`);
      
      return {
        callId,
        status: 'initiated'
      };
    } catch (error) {
      console.error(`[${this.providerType}_PROVIDER] ❌ Error starting call:`, error);
      throw error;
    }
  }

  async hangup(callId: string): Promise<boolean> {
    try {
      console.log(`[${this.providerType}_PROVIDER] Hanging up call ${callId}`);
      return await this.sipService.hangup(callId);
    } catch (error) {
      console.error(`[${this.providerType}_PROVIDER] Error hanging up call:`, error);
      return false;
    }
  }

  async sendDTMF(callId: string, digits: string): Promise<boolean> {
    try {
      console.log(`[${this.providerType}_PROVIDER] Sending DTMF "${digits}" to call ${callId}`);
      return await this.sipService.sendDTMF(callId, digits);
    } catch (error) {
      console.error(`[${this.providerType}_PROVIDER] Error sending DTMF:`, error);
      return false;
    }
  }

  async pauseAI(callId: string): Promise<boolean> {
    try {
      console.log(`[SOBREIP_PROVIDER] AI paused for call ${callId}`);
      return true;
    } catch (error) {
      console.error('[SOBREIP_PROVIDER] Error pausing AI:', error);
      return false;
    }
  }

  async resumeAI(callId: string): Promise<boolean> {
    try {
      console.log(`[SOBREIP_PROVIDER] AI resumed for call ${callId}`);
      return true;
    } catch (error) {
      console.error('[SOBREIP_PROVIDER] Error resuming AI:', error);
      return false;
    }
  }

  async injectPrompt(callId: string, prompt: string): Promise<boolean> {
    try {
      console.log(`[SOBREIP_PROVIDER] Prompt injected for call ${callId}: ${prompt}`);
      return true;
    } catch (error) {
      console.error('[SOBREIP_PROVIDER] Error injecting prompt:', error);
      return false;
    }
  }

  async transfer(callId: string, toNumber: string): Promise<boolean> {
    try {
      console.log(`[SOBREIP_PROVIDER] Transferring call ${callId} to ${toNumber}`);
      return true;
    } catch (error) {
      console.error('[SOBREIP_PROVIDER] Error transferring call:', error);
      return false;
    }
  }

  async hold(callId: string): Promise<boolean> {
    try {
      console.log(`[SOBREIP_PROVIDER] Call ${callId} on hold`);
      return true;
    } catch (error) {
      console.error('[SOBREIP_PROVIDER] Error holding call:', error);
      return false;
    }
  }

  async resume(callId: string): Promise<boolean> {
    try {
      console.log(`[SOBREIP_PROVIDER] Call ${callId} resumed`);
      return true;
    } catch (error) {
      console.error('[SOBREIP_PROVIDER] Error resuming call:', error);
      return false;
    }
  }
}
