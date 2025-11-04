import { createRequire } from 'module';
import { randomUUID } from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const require = createRequire(import.meta.url);
// @ts-ignore - Module 'sip' lacks type definitions
const sip = require('sip');
// @ts-ignore - Module 'sip/digest' lacks type definitions
const digest = require('sip/digest');

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

export class SIPService {
  private initialized: boolean = false;
  private activeCalls: Map<string, SIPCall> = new Map();
  private sipUsername: string;
  private sipPassword: string;
  private sipServer: string;
  private sipPort: number;
  private localIP: string;
  private fromNumber: string;
  private authSession: any = {};
  private registered: boolean = false;

  constructor(
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
    this.localIP = '172.31.70.162'; // Replit server IP
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[SIP_SERVICE] Already initialized');
      return;
    }

    try {
      // Detect local IP if needed
      try {
        const { stdout } = await execAsync("hostname -I | awk '{print $1}'");
        const detectedIP = stdout.trim();
        if (detectedIP && detectedIP !== '127.0.0.1') {
          this.localIP = detectedIP;
        }
      } catch (err) {
        console.warn('[SIP_SERVICE] Could not detect IP, using default:', this.localIP);
      }

      console.log('[SIP_SERVICE] Initializing SIP stack...');
      console.log(`[SIP_SERVICE] Local IP: ${this.localIP}`);
      console.log(`[SIP_SERVICE] Server: ${this.sipServer}:${this.sipPort}`);
      console.log(`[SIP_SERVICE] Username: ${this.sipUsername}`);
      
      // Start SIP stack only once (singleton pattern)
      if (!globalSipStarted) {
        console.log('[SIP_SERVICE] Starting SIP stack for the first time...');
        sip.start({
          publicAddress: this.localIP,
          port: 6060, // Use port 6060 for client
          tcp: false,
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

        // Wait for SIP stack to fully initialize (sip.send becomes available)
        await new Promise(resolve => setTimeout(resolve, 500));
        globalSipStarted = true;
        console.log('[SIP_SERVICE] Global SIP stack started successfully');
      } else {
        console.log('[SIP_SERVICE] Reusing existing SIP stack');
        // Small delay to ensure previous messages are processed
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      this.initialized = true;
      console.log('[SIP_SERVICE] ✅ SIP stack initialized successfully');
      
      // Register with server
      await this.register();
    } catch (error) {
      console.error('[SIP_SERVICE] ❌ Failed to initialize:', error);
      throw error;
    }
  }

  private async register(authChallenge?: any): Promise<void> {
    const isReregister = !!authChallenge;
    console.log(`[SIP_SERVICE] ${isReregister ? 'Re-registering with auth' : 'Registering'}...`);
    
    const callId = this.authSession.callId || randomUUID();
    const tag = this.authSession.tag || randomUUID();
    const cseq = (this.authSession.cseq || 0) + 1;
    
    this.authSession.callId = callId;
    this.authSession.tag = tag;
    this.authSession.cseq = cseq;
    
    try {
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
          contact: [{ uri: `sip:${this.sipUsername}@${this.localIP}:6060` }],
          expires: 3600,
          via: []
        }
      };

      // Add digest authentication if we have a challenge
      if (authChallenge) {
        const credentials = {
          user: this.sipUsername,
          password: this.sipPassword
        };
        
        digest.signRequest(this.authSession, registerRequest, credentials);
        console.log('[SIP_SERVICE] Added Authorization header for REGISTER');
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

    if (!this.registered) {
      throw new Error('SIP not registered - wait for registration to complete');
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
          contact: [{ uri: `sip:${this.sipUsername}@${this.localIP}:6060` }],
          'content-type': 'application/sdp',
          via: [{
            version: '2.0',
            protocol: 'UDP',
            host: this.localIP,
            port: 6060,
            params: { branch }
          }]
        },
        content: sdp
      };

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
        } else {
          console.error(`[SIP_SERVICE] ❌ Registration failed with status ${message.status}`);
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
    
    return [
      `v=0`,
      `o=- ${sessionId} ${version} IN IP4 ${this.localIP}`,
      `s=Abmix Call`,
      `c=IN IP4 ${this.localIP}`,
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
