import { createRequire } from 'module';
import { randomUUID } from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import { networkInterfaces } from 'os';

const require = createRequire(import.meta.url);
// @ts-ignore - Module 'sip' has no type definitions
const sip = require('sip');
// @ts-ignore
const digest = require('sip/digest.js');

const execAsync = promisify(exec);

interface SIPDialog {
  local: any;
  remote: any;
  routeSet: any[];
  cseq: number;
  inviteRequest: any;
  lastResponse: any;
}

interface SIPCall {
  callId: string;
  toNumber: string;
  fromNumber: string;
  dialog?: SIPDialog;
  status: 'initiating' | 'ringing' | 'answered' | 'ended' | 'failed';
  startTime: Date;
  endTime?: Date;
  error?: string;
}

// Global flag to track if SIP stack was started (singleton pattern)
let globalSipStarted = false;

// Global singleton instance of SIPService
let globalSipServiceInstance: SIPService | null = null;

export class SIPService {
  private initialized: boolean = false;
  private activeCalls: Map<string, SIPCall> = new Map();
  private sipUsername: string;
  private sipPassword: string;
  private sipServer: string;
  private sipPort: number;
  private localIP: string;
  private publicIP: string;
  private fromNumber: string;
  private authSession: any = {};
  private registered: boolean = false;
  private clientPort: number = 7060;
  private transport: 'TCP' | 'UDP' = 'UDP'; // Store active transport protocol
  private registrationPromise: Promise<void> | null = null;
  private registrationResolve: (() => void) | null = null;
  private registrationReject: ((error: Error) => void) | null = null;
  private registrationAttempts: number = 0;
  private maxRegistrationAttempts: number = 3;

  private constructor(
    sipUsername: string,
    sipPassword: string,
    sipServer: string,
    fromNumber: string,
    sipPort: number = 5060
  ) {
    this.sipUsername = sipUsername;
    this.sipPassword = sipPassword;
    this.sipServer = sipServer;
    this.sipPort = sipPort;
    this.fromNumber = fromNumber;
    this.localIP = process.env.FALEVONO_LOCAL_IP?.trim() || '127.0.0.1';
    this.publicIP = process.env.FALEVONO_PUBLIC_IP?.trim() || this.localIP;
  }

  private static detectFirstExternalIPv4(): string | null {
    const interfaces = networkInterfaces();

    for (const name of Object.keys(interfaces)) {
      const entries = interfaces[name];
      if (!entries) continue;

      for (const entry of entries) {
        if (!entry) continue;
        const family = typeof entry.family === 'string' ? entry.family : entry.family === 4 ? 'IPv4' : '';
        if (family === 'IPv4' && !entry.internal) {
          return entry.address;
        }
      }
    }

    return null;
  }

  private static isPrivateIPv4(ip: string): boolean {
    return (
      ip === '127.0.0.1' ||
      ip.startsWith('10.') ||
      ip.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
    );
  }

  private async configureIpAddresses(): Promise<void> {
    const envLocal = process.env.FALEVONO_LOCAL_IP?.trim();
    const envPublic = process.env.FALEVONO_PUBLIC_IP?.trim();

    if (envLocal) {
      this.localIP = envLocal;
    } else {
      const autoDetected = SIPService.detectFirstExternalIPv4();
      if (autoDetected) {
        this.localIP = autoDetected;
      } else {
        try {
          const { stdout } = await execAsync('hostname -I');
          const firstIp = stdout
            .split(/\s+/)
            .map(part => part.trim())
            .find(part => part.length > 0);

          if (firstIp) {
            this.localIP = firstIp;
          }
        } catch (error) {
          console.warn('[SIP_SERVICE] Could not detect IP automatically, keeping current value:', this.localIP);
        }
      }
    }

    if (envPublic) {
      this.publicIP = envPublic;
    } else if (envLocal && !SIPService.isPrivateIPv4(envLocal)) {
      this.publicIP = envLocal;
    } else if (!SIPService.isPrivateIPv4(this.localIP)) {
      this.publicIP = this.localIP;
    } else {
      this.publicIP = this.localIP;
      console.warn(
        '[SIP_SERVICE] Local IP is in a private range. Set FALEVONO_PUBLIC_IP to the public IP if your SIP provider requires it.'
      );
    }
  }

  private getSignalingHost(): string {
    return this.publicIP || this.localIP;
  }

  // Singleton getInstance method
  static getInstance(
    sipUsername: string,
    sipPassword: string,
    sipServer: string,
    fromNumber: string,
    sipPort: number = 5060
  ): SIPService {
    if (!globalSipServiceInstance) {
      console.log('[SIP_SERVICE] Creating new global SIPService instance');
      globalSipServiceInstance = new SIPService(sipUsername, sipPassword, sipServer, fromNumber, sipPort);
    } else {
      console.log('[SIP_SERVICE] Reusing existing global SIPService instance');
    }
    return globalSipServiceInstance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[SIP_SERVICE] Already initialized');
      return;
    }

    try {
      await this.configureIpAddresses();

      console.log('[SIP_SERVICE] Initializing SIP stack...');
      console.log(`[SIP_SERVICE] Local IP: ${this.localIP}`);
      if (this.publicIP !== this.localIP) {
        console.log(`[SIP_SERVICE] Public IP: ${this.publicIP}`);
      }
      console.log(`[SIP_SERVICE] Server: ${this.sipServer}:${this.sipPort}`);
      console.log(`[SIP_SERVICE] Username: ${this.sipUsername}`);
      console.log(`[SIP_SERVICE] Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`[SIP_SERVICE] Password configured: ${process.env.FALEVONO_PASSWORD ? '✅ YES' : '❌ NO'}`);
      
      // Get SIP client port from environment variable (default: 7060)
      this.clientPort = parseInt(process.env.FALEVONO_SIP_PORT || '7060', 10);
      
      // Determine transport protocol (UDP or TCP)
      // NOTE: UDP is blocked in Replit development environment - use TCP or deploy to production
      const useTCP = process.env.SIP_USE_TCP === 'true' || process.env.NODE_ENV === 'development';
      this.transport = useTCP ? 'TCP' : 'UDP'; // Store for use in headers
      
      // Start SIP stack only once (singleton pattern)
      if (!globalSipStarted) {
        console.log('[SIP_SERVICE] Starting SIP stack for the first time...');
        console.log(`[SIP_SERVICE] Transport: ${this.transport} ${useTCP ? '(UDP blocked in Replit dev)' : ''}`);
        console.log(`[SIP_SERVICE] Client Port: ${this.clientPort}`);
        
        // Initialize SIP stack with proper error handling
        try {
          sip.start({
            publicAddress: this.publicIP,
            port: this.clientPort,
            tcp: useTCP,
            logger: {
              send: (message: any) => {
                console.log('[SIP_SERVICE] >>> SENT:', JSON.stringify(message, null, 2).substring(0, 500));
              },
              recv: (message: any) => {
                console.log('[SIP_SERVICE] <<< RECEIVED:', JSON.stringify(message, null, 2).substring(0, 500));
                this.handleIncomingMessage(message);
              }
            }
          }, (request: any) => {
            this.handleIncomingRequest(request);
          });
          
          // Wait for SIP stack to fully initialize with longer timeout
          console.log('[SIP_SERVICE] Waiting for SIP stack initialization...');
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Verify sip.send is available with multiple attempts
          let attempts = 0;
          const maxAttempts = 10;
          
          while (attempts < maxAttempts && typeof sip.send !== 'function') {
            console.log(`[SIP_SERVICE] Attempt ${attempts + 1}/${maxAttempts}: Waiting for sip.send...`);
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
          }
          
          if (typeof sip.send !== 'function') {
            console.error('[SIP_SERVICE] ❌ sip.send is still not available after all attempts!');
            console.error('[SIP_SERVICE] Available sip methods:', Object.keys(sip));
            throw new Error('SIP stack failed to initialize properly - sip.send not available');
          }
          
          globalSipStarted = true;
          console.log('[SIP_SERVICE] ✅ SIP stack started successfully');
          
        } catch (error) {
          console.error('[SIP_SERVICE] ❌ Failed to start SIP stack:', error);
          throw new Error(`Failed to initialize SIP stack: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else {
        console.log('[SIP_SERVICE] Reusing existing SIP stack');
        
        // Even when reusing, verify sip.send is still available
        if (typeof sip.send !== 'function') {
          console.error('[SIP_SERVICE] ❌ sip.send not available in existing stack!');
          // Reset the global flag to force re-initialization
          globalSipStarted = false;
          throw new Error('SIP stack corrupted - sip.send not available');
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      this.initialized = true;
      console.log('[SIP_SERVICE] ✅ SIP stack initialized successfully');
      
      // Create registration promise
      this.registrationPromise = new Promise((resolve, reject) => {
        this.registrationResolve = resolve;
        this.registrationReject = reject;
        
        // Set timeout for registration (30 seconds for TCP, 20 for UDP in production)
        const isProduction = process.env.NODE_ENV === 'production';
        const timeout = isProduction ? (useTCP ? 30000 : 20000) : (useTCP ? 15000 : 10000);
        
        console.log(`[SIP_SERVICE] Registration timeout set to ${timeout / 1000} seconds (${isProduction ? 'production' : 'development'} mode)`);
        
        setTimeout(async () => {
          if (!this.registered) {
            // Try retry if we haven't exceeded max attempts
            if (this.registrationAttempts < this.maxRegistrationAttempts) {
              console.log(`[SIP_SERVICE] ⏰ Registration timeout, retrying... (${this.registrationAttempts}/${this.maxRegistrationAttempts})`);
              try {
                await this.register();
                return; // Don't reject if retry is in progress
              } catch (retryError) {
                console.error('[SIP_SERVICE] ❌ Retry failed:', retryError);
              }
            }
            
            const env = process.env.NODE_ENV || 'production';
            let errorMsg = `SIP registration timeout after ${timeout / 1000} seconds (${this.registrationAttempts} attempts)`;
            
            if (env === 'development') {
              errorMsg += '\n\n⚠️  REPLIT LIMITATION: UDP ports are blocked in development.\n';
              errorMsg += 'Solutions:\n';
              errorMsg += '1. Set SIP_USE_TCP=true to try TCP (may not work with all providers)\n';
              errorMsg += '2. Deploy to production (EasyPanel/VPS) where UDP works\n';
              errorMsg += '3. Test locally with Docker\n';
            } else {
              errorMsg += '\n\n🔧 PRODUCTION TROUBLESHOOTING:\n';
              errorMsg += '1. Check if UDP port 5060 is accessible from EasyPanel\n';
              errorMsg += '2. Verify FALEVONO_PASSWORD is correct\n';
              errorMsg += '3. Try TCP fallback: Set SIP_USE_TCP=true\n';
              errorMsg += '4. Check if SIP server vono2.me:5060 is reachable\n';
              errorMsg += '5. Check network connectivity to vono2.me\n';
            }
            
            reject(new Error(errorMsg));
          }
        }, timeout);
      });
      
      // Register with server
      await this.register();
    } catch (error) {
      console.error('[SIP_SERVICE] ❌ Failed to initialize:', error);
      throw error;
    }
  }

  private async register(authChallenge?: any): Promise<void> {
    const isReregister = !!authChallenge;
    
    if (!isReregister) {
      this.registrationAttempts++;
      console.log(`[SIP_SERVICE] Registration attempt ${this.registrationAttempts}/${this.maxRegistrationAttempts}`);
    } else {
      console.log(`[SIP_SERVICE] Re-registering with auth challenge...`);
    }
    
    const callId = this.authSession.callId || randomUUID();
    const tag = this.authSession.tag || randomUUID();
    const cseq = (this.authSession.cseq || 0) + 1;
    
    this.authSession.callId = callId;
    this.authSession.tag = tag;
    this.authSession.cseq = cseq;
    
    try {
      const signalingHost = this.getSignalingHost();

      // Build contact URI with transport parameter if using TCP
      const contactUri = this.transport === 'TCP' 
        ? `sip:${this.sipUsername}@${signalingHost}:${this.clientPort};transport=tcp`
        : `sip:${this.sipUsername}@${signalingHost}:${this.clientPort}`;
      
      const registerRequest: any = {
        method: 'REGISTER',
        uri: `sip:${this.sipServer}:${this.sipPort}`,
        headers: {
          to: { uri: `sip:${this.sipUsername}@${this.sipServer}` },
          from: { 
            uri: `sip:${this.sipUsername}@${this.sipServer}`,
            params: { tag }
          },
          'call-id': callId,
          cseq: { method: 'REGISTER', seq: cseq },
          contact: [{ uri: contactUri }],
          expires: 3600,
          via: []
        }
      };
      
      console.log(`[SIP_SERVICE] REGISTER with transport=${this.transport}, contact=${contactUri}`);

      // Add digest authentication if we have a challenge
      if (authChallenge) {
        const credentials = {
          user: this.sipUsername,
          password: this.sipPassword
        };
        
        digest.signRequest(this.authSession, registerRequest, credentials);
        console.log('[SIP_SERVICE] Added Authorization header for REGISTER');
      }
      
      // Verify sip.send is available before using it
      if (typeof sip.send !== 'function') {
        console.error('[SIP_SERVICE] ❌ sip.send is not available during registration!');
        throw new Error('SIP stack not properly initialized - sip.send not available');
      }
      
      sip.send(registerRequest, (error: any) => {
        if (error) {
          console.error('[SIP_SERVICE] ❌ Error sending REGISTER:', error);
        } else {
          console.log('[SIP_SERVICE] ✅ REGISTER sent');
        }
      });
      console.log('[SIP_SERVICE] REGISTER request queued');
    } catch (error) {
      console.error('[SIP_SERVICE] ❌ Registration failed:', error);
    }
  }

  async makeCall(toNumber: string): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Wait for registration to complete (with timeout)
    if (!this.registered) {
      console.log('[SIP_SERVICE] Waiting for SIP registration to complete...');
      try {
        await this.registrationPromise;
        console.log('[SIP_SERVICE] Registration completed, proceeding with call');
      } catch (error) {
        throw new Error(`Cannot make call: ${error instanceof Error ? error.message : 'Registration failed'}`);
      }
    }

    const callId = randomUUID();
    const tag = randomUUID();
    const branch = `z9hG4bK${randomUUID()}`;
    
    // Clean phone number (remove non-digits)
    const cleanNumber = toNumber.replace(/[^\d]/g, '');
    
    const call: SIPCall = {
      callId,
      toNumber: cleanNumber,
      fromNumber: this.fromNumber,
      status: 'initiating',
      startTime: new Date()
    };
    
    this.activeCalls.set(callId, call);
    
    console.log('[SIP_SERVICE] 📞 Making call...');
    console.log(`[SIP_SERVICE]   From: ${this.fromNumber} (${this.sipUsername})`);
    console.log(`[SIP_SERVICE]   To: ${cleanNumber}`);
    console.log(`[SIP_SERVICE]   Call-ID: ${callId}`);
    
    // Create minimal SDP for audio-only call
    const sdp = this.createSDP();
    
    try {
      const signalingHost = this.getSignalingHost();

      // Build contact URI with transport parameter if using TCP
      const contactUri = this.transport === 'TCP' 
        ? `sip:${this.sipUsername}@${signalingHost}:${this.clientPort};transport=tcp`
        : `sip:${this.sipUsername}@${signalingHost}:${this.clientPort}`;
      
      const inviteRequest: any = {
        method: 'INVITE',
        uri: `sip:${cleanNumber}@${this.sipServer}:${this.sipPort}`,
        headers: {
          to: { uri: `sip:${cleanNumber}@${this.sipServer}` },
          from: { 
            uri: `sip:${this.sipUsername}@${this.sipServer}`,
            params: { tag }
          },
          'call-id': callId,
          cseq: { method: 'INVITE', seq: 1 },
          contact: [{ uri: contactUri }],
          'content-type': 'application/sdp',
          via: [{
            version: '2.0',
            protocol: this.transport, // Use configured transport (TCP or UDP)
            host: signalingHost,
            port: this.clientPort,
            params: { branch }
          }]
        },
        content: sdp
      };
      
      console.log(`[SIP_SERVICE] INVITE with transport=${this.transport}, contact=${contactUri}`);

      // Store invite request for later use in ACK/CANCEL
      if (!call.dialog) {
        call.dialog = {
          local: inviteRequest.headers.from,
          remote: inviteRequest.headers.to,
          routeSet: [],
          cseq: 1,
          inviteRequest: inviteRequest,
          lastResponse: null
        };
      }
      
      // Verify sip.send is available before using it
      if (typeof sip.send !== 'function') {
        console.error('[SIP_SERVICE] ❌ sip.send is not available during call initiation!');
        call.status = 'failed';
        call.error = 'SIP stack not properly initialized - sip.send not available';
        call.endTime = new Date();
        throw new Error('SIP stack not properly initialized - sip.send not available');
      }
      
      sip.send(inviteRequest, (error: any) => {
        if (error) {
          console.error('[SIP_SERVICE] ❌ Error sending INVITE:', error);
          call.status = 'failed';
          call.error = String(error);
          call.endTime = new Date();
        } else {
          call.status = 'ringing';
          console.log('[SIP_SERVICE] ✅ INVITE sent');
        }
      });
      return callId;
    } catch (error) {
      console.error('[SIP_SERVICE] ❌ Failed to send INVITE:', error);
      call.status = 'failed';
      call.error = String(error);
      call.endTime = new Date();
      throw error;
    }
  }

  private async reInviteWithAuth(call: SIPCall, authResponse: any): Promise<void> {
    if (!call.dialog || !call.dialog.inviteRequest) {
      console.error(`[SIP_SERVICE] ❌ No stored INVITE for re-authentication`);
      call.status = 'failed';
      call.error = 'Cannot re-authenticate without original INVITE';
      call.endTime = new Date();
      return;
    }

    console.log(`[SIP_SERVICE] 🔐 Re-sending INVITE with digest authentication...`);

    try {
      // Create auth session for this call
      const callAuthSession: any = {};
      
      // Process the auth challenge
      digest.challenge(callAuthSession, authResponse);
      
      // Clone the original INVITE request
      const reInviteRequest: any = JSON.parse(JSON.stringify(call.dialog.inviteRequest));
      
      // Increment CSeq for the re-attempt
      call.dialog.cseq++;
      reInviteRequest.headers.cseq.seq = call.dialog.cseq;
      
      // Add digest authentication
      const credentials = {
        user: this.sipUsername,
        password: this.sipPassword
      };
      
      digest.signRequest(callAuthSession, reInviteRequest, credentials);
      
      // Update dialog state
      call.dialog.inviteRequest = reInviteRequest;
      
      // Verify sip.send is available before using it
      if (typeof sip.send !== 'function') {
        console.error('[SIP_SERVICE] ❌ sip.send is not available during re-authentication!');
        call.status = 'failed';
        call.error = 'SIP stack not properly initialized - sip.send not available';
        call.endTime = new Date();
        return;
      }
      
      // Send authenticated INVITE
      sip.send(reInviteRequest, (error: any) => {
        if (error) {
          console.error('[SIP_SERVICE] ❌ Error sending authenticated INVITE:', error);
          call.status = 'failed';
          call.error = String(error);
          call.endTime = new Date();
        } else {
          console.log('[SIP_SERVICE] ✅ Authenticated INVITE sent');
          call.status = 'ringing';
        }
      });
    } catch (error) {
      console.error('[SIP_SERVICE] ❌ Failed to re-send INVITE with auth:', error);
      call.status = 'failed';
      call.error = `Authentication failed: ${error}`;
      call.endTime = new Date();
    }
  }

  async hangup(callId: string): Promise<boolean> {
    const call = this.activeCalls.get(callId);
    if (!call) {
      console.warn(`[SIP_SERVICE] Call ${callId} not found`);
      return false;
    }

    console.log(`[SIP_SERVICE] 📴 Hanging up call ${callId} (status: ${call.status})`);
    
    try {
      if (call.status === 'answered' && call.dialog && call.dialog.lastResponse) {
        // Send BYE for established calls
        const contactUri = call.dialog.lastResponse.headers.contact?.[0]?.uri 
          || call.dialog.remote.uri;

        const byeRequest: any = {
          method: 'BYE',
          uri: contactUri,
          headers: {
            to: call.dialog.remote,
            from: call.dialog.local,
            'call-id': callId,
            cseq: { method: 'BYE', seq: call.dialog.cseq + 1 },
            via: call.dialog.inviteRequest.headers.via
          }
        };

        sip.send(byeRequest, (error: any) => {
          if (error) {
            console.error('[SIP_SERVICE] ❌ Error sending BYE:', error);
          } else {
            console.log('[SIP_SERVICE] ✅ BYE sent');
          }
        });
      } else if (call.status === 'ringing' || call.status === 'initiating') {
        // Send CANCEL for ringing calls
        if (call.dialog && call.dialog.inviteRequest) {
          const cancelRequest: any = {
            method: 'CANCEL',
            uri: call.dialog.inviteRequest.uri,
            headers: {
              to: call.dialog.inviteRequest.headers.to,
              from: call.dialog.inviteRequest.headers.from,
              'call-id': callId,
              cseq: { method: 'CANCEL', seq: call.dialog.inviteRequest.headers.cseq.seq },
              via: call.dialog.inviteRequest.headers.via
            }
          };

          sip.send(cancelRequest, (error: any) => {
            if (error) {
              console.error('[SIP_SERVICE] ❌ Error sending CANCEL:', error);
            } else {
              console.log('[SIP_SERVICE] ✅ CANCEL sent');
            }
          });
        }
      }
      
      call.status = 'ended';
      call.endTime = new Date();
      return true;
    } catch (error) {
      console.error('[SIP_SERVICE] ❌ Failed to hangup:', error);
      return false;
    }
  }

  async sendDTMF(callId: string, digits: string): Promise<boolean> {
    const call = this.activeCalls.get(callId);
    if (!call || !call.dialog || call.status !== 'answered') {
      console.warn(`[SIP_SERVICE] Call ${callId} not active for DTMF`);
      return false;
    }

    console.log(`[SIP_SERVICE] 🔢 Sending DTMF: ${digits}`);
    
    try {
      const contactUri = call.dialog.lastResponse.headers.contact?.[0]?.uri 
        || call.dialog.remote.uri;

      const infoRequest: any = {
        method: 'INFO',
        uri: contactUri,
        headers: {
          to: call.dialog.remote,
          from: call.dialog.local,
          'call-id': callId,
          cseq: { method: 'INFO', seq: call.dialog.cseq + 1 },
          'content-type': 'application/dtmf-relay',
          via: call.dialog.inviteRequest.headers.via
        },
        content: `Signal=${digits}\r\nDuration=100`
      };

      call.dialog.cseq++;
      sip.send(infoRequest, (error: any) => {
        if (error) {
          console.error('[SIP_SERVICE] ❌ Error sending DTMF:', error);
        } else {
          console.log('[SIP_SERVICE] ✅ DTMF sent');
        }
      });
      
      return true;
    } catch (error) {
      console.error('[SIP_SERVICE] ❌ Failed to send DTMF:', error);
      return false;
    }
  }

  getCallStatus(callId: string): SIPCall | undefined {
    return this.activeCalls.get(callId);
  }

  getAllCalls(): SIPCall[] {
    return Array.from(this.activeCalls.values());
  }

  private handleIncomingMessage(message: any): void {
    // Handle responses (200 OK, 180 Ringing, 401/407 Auth, etc)
    if (message.status) {
      const callId = message.headers['call-id'];
      
      // Handle REGISTER responses
      if (message.headers.cseq?.method === 'REGISTER') {
        if (message.status === 401 || message.status === 407) {
          console.log(`[SIP_SERVICE] 🔐 Received ${message.status} auth challenge for REGISTER`);
          digest.challenge(this.authSession, message);
          this.register(message);
        } else if (message.status === 200) {
          console.log('[SIP_SERVICE] ✅ Registration successful!');
          this.registered = true;
          // Resolve registration promise
          if (this.registrationResolve) {
            this.registrationResolve();
            this.registrationResolve = null;
            this.registrationReject = null;
          }
        } else {
          console.error(`[SIP_SERVICE] ❌ Registration failed with status ${message.status}`);
          // Reject registration promise
          if (this.registrationReject) {
            this.registrationReject(new Error(`Registration failed with status ${message.status}`));
            this.registrationResolve = null;
            this.registrationReject = null;
          }
        }
        return;
      }

      // Handle INVITE responses
      const call = this.activeCalls.get(callId);
      if (!call) return;

      switch (message.status) {
        case 100:
          console.log(`[SIP_SERVICE] 📞 Call ${callId}: Trying...`);
          break;
        case 180:
        case 183:
          console.log(`[SIP_SERVICE] 📞 Call ${callId}: Ringing...`);
          call.status = 'ringing';
          break;
        case 200:
          if (message.headers.cseq.method === 'INVITE') {
            console.log(`[SIP_SERVICE] ✅ Call ${callId}: Answered!`);
            call.status = 'answered';
            // Store the 200 OK response for later use
            if (call.dialog) {
              call.dialog.lastResponse = message;
              // CRITICAL: remote is 'To' header (callee with their tag), not 'From' (us)
              call.dialog.remote = message.headers.to;
              call.dialog.local = message.headers.from;
            }
            // Send ACK
            this.sendAck(call, message);
          }
          break;
        case 401:
        case 407:
          if (message.headers.cseq.method === 'INVITE') {
            console.log(`[SIP_SERVICE] 🔐 Call ${callId}: Auth challenge for INVITE (${message.status})`);
            // Re-send INVITE with digest authentication
            this.reInviteWithAuth(call, message);
          }
          break;
        case 486:
          console.log(`[SIP_SERVICE] 📵 Call ${callId}: Busy`);
          call.status = 'ended';
          call.error = 'Busy';
          call.endTime = new Date();
          break;
        case 487:
          console.log(`[SIP_SERVICE] 📴 Call ${callId}: Cancelled`);
          call.status = 'ended';
          call.endTime = new Date();
          break;
        default:
          if (message.status >= 400) {
            console.log(`[SIP_SERVICE] ❌ Call ${callId}: Error ${message.status} - ${message.reason}`);
            call.status = 'failed';
            call.error = `${message.status} ${message.reason}`;
            call.endTime = new Date();
          }
      }
    }
  }

  private handleIncomingRequest(request: any): void {
    console.log(`[SIP_SERVICE] Incoming request: ${request.method}`);
    
    // Handle incoming calls, BYE, etc
    if (request.method === 'BYE') {
      const callId = request.headers['call-id'];
      const call = this.activeCalls.get(callId);
      
      if (call) {
        console.log(`[SIP_SERVICE] 📴 Remote party hung up call ${callId}`);
        call.status = 'ended';
        call.endTime = new Date();
      }
      
      // Send 200 OK
      sip.send({
        method: 'OK',
        status: 200,
        reason: 'OK',
        headers: request.headers
      }, (error: any) => {
        if (error) {
          console.error('[SIP_SERVICE] ❌ Error sending 200 OK:', error);
        }
      });
    }
  }

  private sendAck(call: SIPCall, inviteResponse: any): void {
    try {
      // ACK must be sent to the Contact URI from the 200 OK, not the original Request-URI
      const contactUri = inviteResponse.headers.contact?.[0]?.uri 
        || inviteResponse.headers.from.uri;

      const ackRequest: any = {
        method: 'ACK',
        uri: contactUri,
        headers: {
          to: inviteResponse.headers.to,
          from: inviteResponse.headers.from,
          'call-id': call.callId,
          cseq: { method: 'ACK', seq: inviteResponse.headers.cseq.seq },
          via: call.dialog?.inviteRequest.headers.via || inviteResponse.headers.via
        }
      };
      
      sip.send(ackRequest, (error: any) => {
        if (error) {
          console.error('[SIP_SERVICE] ❌ Error sending ACK:', error);
        } else {
          console.log('[SIP_SERVICE] ✅ ACK sent to', contactUri);
        }
      });
    } catch (error) {
      console.error('[SIP_SERVICE] ❌ Failed to send ACK:', error);
    }
  }

  private createSDP(): string {
    const sessionId = Date.now();
    const version = 1;
    const signalingHost = this.getSignalingHost();
    
    return [
      `v=0`,
      `o=- ${sessionId} ${version} IN IP4 ${signalingHost}`,
      `s=Abmix Call`,
      `c=IN IP4 ${signalingHost}`,
      `t=0 0`,
      `m=audio 8000 RTP/AVP 0 8 101`,
      `a=rtpmap:0 PCMU/8000`,
      `a=rtpmap:8 PCMA/8000`,
      `a=rtpmap:101 telephone-event/8000`,
      `a=sendrecv`
    ].join('\r\n') + '\r\n';
  }

  async shutdown(): Promise<void> {
    console.log('[SIP_SERVICE] Shutting down...');
    
    // Hangup all active calls
    const callIds = Array.from(this.activeCalls.keys());
    for (const callId of callIds) {
      await this.hangup(callId);
    }
    
    sip.stop();
    this.initialized = false;
    this.registered = false;
    console.log('[SIP_SERVICE] ✅ Shutdown complete');
  }
}
