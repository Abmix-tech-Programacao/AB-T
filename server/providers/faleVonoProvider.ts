import { SIPService } from '../sipService.js';

export interface FaleVonoProvider {
  initialize(): Promise<void>;
  startCall(to: string): Promise<string>;
  hangup(callId: string): Promise<boolean>;
}

export class FaleVonoProviderImpl implements FaleVonoProvider {
  private sipService: SIPService;

  constructor(
    sipUsername: string,
    fromNumber: string,
    sipServer: string = 'vono2.me',
    sipPort: number = 5060
  ) {
    // Get password from environment
    const sipPassword = process.env.FALEVONO_PASSWORD;
    
    if (!sipPassword) {
      throw new Error('FALEVONO_PASSWORD environment variable is required');
    }

    // Get or create singleton SIP service instance
    this.sipService = SIPService.getInstance(
      sipUsername,
      sipPassword,
      sipServer,
      fromNumber,
      sipPort
    );

    console.log('[FALEVONO_PROVIDER] Initialized with:');
    console.log(`[FALEVONO_PROVIDER]   Username: ${sipUsername}`);
    console.log(`[FALEVONO_PROVIDER]   Server: ${sipServer}:${sipPort}`);
    console.log(`[FALEVONO_PROVIDER]   From Number: ${fromNumber}`);
  }

  async initialize(): Promise<void> {
    console.log('[FALEVONO_PROVIDER] Starting SIP initialization and registration...');
    await this.sipService.initialize();
    console.log('[FALEVONO_PROVIDER] ✅ SIP initialization complete');
  }

  async startCall(to: string): Promise<string> {
    console.log(`[FALEVONO_PROVIDER] Starting call to: ${to}`);
    try {
      const callId = await this.sipService.makeCall(to);
      console.log(`[FALEVONO_PROVIDER] Call initiated with ID: ${callId}`);
      return callId;
    } catch (error) {
      console.error('[FALEVONO_PROVIDER] Failed to start call:', error);
      throw error;
    }
  }

  async hangup(callId: string): Promise<boolean> {
    console.log(`[FALEVONO_PROVIDER] Hanging up call: ${callId}`);
    try {
      const success = await this.sipService.hangup(callId);
      console.log(`[FALEVONO_PROVIDER] Hangup ${success ? 'successful' : 'failed'}`);
      return success;
    } catch (error) {
      console.error('[FALEVONO_PROVIDER] Failed to hangup:', error);
      throw error;
    }
  }
}
