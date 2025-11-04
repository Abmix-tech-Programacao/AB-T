// Load environment variables first
import { config } from "dotenv";
config();

import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import twilio from "twilio";
import { elevenLabsService } from "./elevenlabs";
import { voiceConversionService } from "./voiceConversionService";
import { realtimeVoiceService } from "./realtimeVoiceService";
import { queries } from "./database";
import { writeFileSync, statSync } from "fs";
import { join } from "path";

// Environment variables - com debug
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_NUMBER = process.env.TWILIO_NUMBER;

// Debug das variáveis no módulo telephony
console.log('[TELEPHONY] Debug das variáveis:');
console.log(`[TELEPHONY] TWILIO_NUMBER: ${TWILIO_NUMBER || '❌ UNDEFINED'}`);
console.log(`[TELEPHONY] TWILIO_ACCOUNT_SID: ${TWILIO_ACCOUNT_SID ? `${TWILIO_ACCOUNT_SID.substring(0, 10)}...` : '❌ UNDEFINED'}`);
console.log(`[TELEPHONY] TWILIO_AUTH_TOKEN: ${TWILIO_AUTH_TOKEN ? `${TWILIO_AUTH_TOKEN.substring(0, 10)}...` : '❌ UNDEFINED'}`);

function resolvePublicBaseUrl(req?: any): string {
  const configured = process.env.PUBLIC_BASE_URL || process.env.PUBLIC_URL || process.env.NGROK_URL;
  if (configured) return configured.replace(/\/$/, "");
  
  // Para desenvolvimento local, verificar se temos ngrok ou túnel
  if (process.env.NODE_ENV === 'development') {
    // Se não tiver ngrok configurado, usar simulação local
    console.log('[TELEPHONY] Desenvolvimento local - simulando media stream');
    return 'local-simulation';
  }
  
  if (!req) return "";
  const host = (req.headers?.['x-forwarded-host'] as string) || req.headers?.host;
  const proto = (req.headers?.['x-forwarded-proto'] as string) || (req.protocol || 'http');
  if (host) return `${proto}://${host}`;
  return '';
}

function resolveWebSocketBasePath(): string {
  const configured = process.env.PUBLIC_BASE_PATH || process.env.PUBLIC_BASE_URL || process.env.PUBLIC_URL || process.env.NGROK_URL;
  if (!configured) return '';

  let candidate = configured.trim();
  if (!candidate) return '';

  if (candidate.includes('://')) {
    try {
      candidate = new URL(candidate).pathname || '';
    } catch {
      candidate = '';
    }
  }

  if (!candidate) return '';

  if (!candidate.startsWith('/')) {
    candidate = `/${candidate}`;
  }

  if (candidate.length > 1 && candidate.endsWith('/')) {
    candidate = candidate.slice(0, -1);
  }

  return candidate === '/' ? '' : candidate;
}

const WS_BASE_PATH = resolveWebSocketBasePath();
const buildWsPath = (suffix: string) => {
  const normalizedSuffix = suffix.startsWith('/') ? suffix : `/${suffix}`;
  return WS_BASE_PATH ? `${WS_BASE_PATH}${normalizedSuffix}` : normalizedSuffix;
};

// Initialize Twilio client
const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// Active calls and sessions tracking
const activeCalls = new Map();
const activeRecordings = new Map();
const mediaStreams = new Map();

// Latency tracking for metrics
let latencyMetrics: number[] = [];

// Audio processing function for real-time voice conversion
function processUserAudio(callSid: string, audioPayload: string, streamSid: string | null, ws: any) {
  try {
    // Check if voice conversion is enabled for this call
    if (realtimeVoiceService.isConversionEnabled(callSid)) {
      console.log(`[MEDIA] Processing audio with voice conversion for ${callSid}`);
      // Send audio to real-time voice conversion (STT -> TTS pipeline)
      realtimeVoiceService.processIncomingAudio(callSid, audioPayload);
    } else {
      console.log(`[MEDIA] Passing through original audio for ${callSid}`);
      // Pass through original audio without conversion
      if (streamSid && ws && ws.readyState === ws.OPEN) {
        const message = {
          event: 'media',
          streamSid,
          media: { payload: audioPayload }
        };
        ws.send(JSON.stringify(message));
      }
    }
  } catch (error) {
    console.error('[MEDIA] Error processing user audio:', error);
  }
}

export function setupTelephony(app: Express, httpServer: Server) {
  // WebSocket servers - escutar nos paths que o nginx vai fazer proxy
  const captionsPath = buildWsPath('/captions');
  const mediaPath = buildWsPath('/media');

  const captionsWss = new WebSocketServer({ 
    server: httpServer, 
    path: captionsPath,
    verifyClient: (info) => {
      console.log('[CAPTIONS_WS] Connection attempt from:', info.origin);
      return true; // Aceitar todas as conexões
    }
  });
  
  const mediaWss = new WebSocketServer({ 
    server: httpServer, 
    path: mediaPath,
    verifyClient: (info) => {
      console.log('[MEDIA_WS] Connection attempt from:', info.origin);
      console.log('[MEDIA_WS] Headers:', info.req.headers);
      return true; // Aceitar todas as conexões, incluindo do Twilio
    }
  });

  console.log(`[TELEPHONY] WebSocket servers initialized on ${captionsPath} and ${mediaPath}`);

  // === TELEPHONY ROUTES ===
  
  // NOTA: Rota /api/call/dial movida para routes.ts para usar FaleVono SIP
  // Este arquivo agora só gerencia WebSockets para Twilio (se configurado)

  // NOTA: Rota /api/call/hangup movida para routes.ts para usar FaleVono SIP
  
  // Manter apenas rotas específicas do Twilio WebSocket abaixo (se necessário)
  
  // Legacy Twilio routes (desabilitadas - agora usando FaleVono SIP em routes.ts)
  /*
  app.post("/api/call/hangup", async (req, res) => {
    try {
      const { callSid } = req.body;
      
      if (!callSid) {
        return res.status(400).json({ message: "callSid is required" });
      }

      console.log(`[CALL] Hanging up call: ${callSid}`);

      await twilioClient.calls(callSid).update({ status: 'completed' });
      
      // Clean up session
      activeCalls.delete(callSid);

      console.log(`[CALL] Call ${callSid} hung up successfully`);

      res.json({ message: "Call ended successfully", callSid });
    } catch (error) {
      console.error('[CALL] Error hanging up call:', error);
      res.status(500).json({ message: "Failed to hangup call", error: error instanceof Error ? error.message : String(error) });
    }
  });
  */

  // TwiML endpoint with recording
  app.all("/twiml", (req, res) => {
    console.log(`[TWIML] Serving TwiML response`);

    const base = resolvePublicBaseUrl(req) || '';
    const proto = base.startsWith('https://') ? 'wss' : 'ws';
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Start>
    <Recording trim="do-not-trim"
              recordingStatusCallback="${base}/twilio/recording-status"
              recordingStatusCallbackEvent="completed failed"
              recordingTrack="both"
              playBeep="false"/>
  </Start>
  <Connect>
    <Stream url="${proto}://${base.replace(/^https?:\/\//, '')}/media"/>
  </Connect>
</Response>`;

    res.type('text/xml').send(twiml);
  });

  // === WEBSOCKET HANDLERS ===

  // Handle captions WebSocket connections
  captionsWss.on('connection', (ws, req) => {
    console.log('[CAPTIONS] Client connected to captions WebSocket');
    
    // Send welcome message
    ws.send(JSON.stringify({
      text: 'Sistema de legendas conectado',
      isFinal: false,
      timestamp: Date.now()
    }));

    // Handle connection close
    ws.on('close', () => {
      console.log('[CAPTIONS] Captions WebSocket client disconnected');
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error('[CAPTIONS] Captions WebSocket error:', error);
    });
  });

  // Handle media WebSocket connections from Twilio
  mediaWss.on('connection', (ws, req) => {
    console.log('[MEDIA] Twilio media stream connected');
    
    let callSid: string | null = null;
    let streamSid: string | null = null;

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.event === 'connected') {
          console.log('[MEDIA] Media stream connected');
          
        } else if (data.event === 'start') {
          // Capture identifiers from Twilio
          callSid = data.start?.callSid;
          streamSid = data.start?.streamSid;
          
          console.log(`[MEDIA] Stream started for call: ${callSid}, stream: ${streamSid}`);
          
          if (callSid && streamSid) {
            mediaStreams.set(callSid, { ws, streamSid });
            
            // Get call configuration
            const callInfo = activeCalls.get(callSid);
            const voiceType = (callInfo?.voiceType as 'masc' | 'fem') || 'masc';
            
            console.log(`[MEDIA] Starting voice processing for ${callSid} with voice type: ${voiceType}`);
            
            // Start real-time voice conversion session
            realtimeVoiceService.startRealtimeVoice(callSid, voiceType).then((success) => {
              if (success) {
                console.log(`[REALTIME_VOICE] Session started successfully for ${callSid}`);
              } else {
                console.error(`[REALTIME_VOICE] Failed to start session for ${callSid}`);
              }
            }).catch((error) => {
              console.error(`[REALTIME_VOICE] Error starting session for ${callSid}:`, error);
            });
          }
          
        } else if (data.event === 'media') {
          // Process incoming audio from caller (user's voice)
          if (data.media && data.media.payload && callSid && streamSid) {
            console.log(`[MEDIA] Processing audio chunk for call: ${callSid}`);
            processUserAudio(callSid, data.media.payload, streamSid, ws);
          }
          
        } else if (data.event === 'stop') {
          console.log(`[MEDIA] Stream stopped for call: ${callSid}`);
        }
        
      } catch (error) {
        console.error('[MEDIA] Error processing media message:', error);
      }
    });

    ws.on('close', () => {
      console.log(`[MEDIA] Media stream disconnected for call: ${callSid}`);
      if (callSid) {
        mediaStreams.delete(callSid);
        realtimeVoiceService.stopRealtimeVoice(callSid);
      }
    });

    ws.on('error', (error) => {
      console.error('[MEDIA] Media stream error:', error);
    });
  });

  // Forward STT results to captions WebSocket
  elevenLabsService.on('stt-transcript', (transcript) => {
    captionsWss.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify(transcript));
      }
    });
  });

  // Forward ElevenLabs TTS audio to the Twilio stream
  elevenLabsService.on('tts-audio', (sessionId: string, audioBuffer: Buffer) => {
    const entry = mediaStreams.get(sessionId) as any;
    if (!entry) return;
    const { ws, streamSid } = entry;
    if (!ws || ws.readyState !== ws.OPEN) return;
    try {
      const payload = audioBuffer.toString('base64');
      const message = {
        event: 'media',
        streamSid,
        media: { payload }
      };
      ws.send(JSON.stringify(message));
    } catch (e) {
      console.error('[MEDIA] Failed to send TTS audio to Twilio:', e);
    }
  });

  // Forward converted voice audio from real-time service to Twilio stream
  realtimeVoiceService.on('converted-voice-audio', (callSid: string, audioBuffer: Buffer) => {
    const entry = mediaStreams.get(callSid) as any;
    if (!entry) {
      console.log(`[MEDIA] No stream found for call: ${callSid}`);
      return;
    }
    
    const { ws, streamSid } = entry;
    if (!ws || ws.readyState !== ws.OPEN) {
      console.log(`[MEDIA] WebSocket not ready for call: ${callSid}`);
      return;
    }
    
    try {
      const payload = audioBuffer.toString('base64');
      const message = {
        event: 'media',
        streamSid,
        media: { payload }
      };
      
      console.log(`[MEDIA] Sending converted audio to Twilio for call: ${callSid}`);
      ws.send(JSON.stringify(message));
    } catch (e) {
      console.error('[MEDIA] Failed to send converted audio to Twilio:', e);
    }
  });

  // === AI/PROMPT ROUTES ===

  // Send live prompt
  app.post("/api/ai/prompt", (req, res) => {
    try {
      const { text, style = 'neutro' } = req.body;
      
      if (!text) {
        return res.status(400).json({ message: "text is required" });
      }

      console.log(`[AI] Sending live prompt: "${text}" with style: ${style}`);

      // Find active TTS sessions and send prompt
      let sentCount = 0;
      activeCalls.forEach((callData, callSid) => {
        if (elevenLabsService.sendTTSText(callSid, text, style)) {
          sentCount++;
        }
      });

      res.json({ 
        message: "Prompt sent", 
        text, 
        style, 
        activeSessions: sentCount 
      });
    } catch (error) {
      console.error('[AI] Error sending prompt:', error);
      res.status(500).json({ message: "Failed to send prompt", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // === VOICE/SETTINGS ROUTES ===

  // Get voices from ElevenLabs
  app.get("/api/voices", async (req, res) => {
    try {
      const voices = await elevenLabsService.getVoices();
      res.json(voices);
    } catch (error) {
      console.error('[VOICES] Error fetching voices:', error);
      res.status(500).json({ message: "Failed to fetch voices", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // === VOICE CONVERSION ROUTES ===

  // Toggle voice conversion for a call
  app.post("/api/voice/toggle", (req, res) => {
    try {
      const { callSid, enabled } = req.body;
      
      if (!callSid) {
        return res.status(400).json({ message: "callSid is required" });
      }

      const success = realtimeVoiceService.setConversionEnabled(callSid, enabled);
      
      if (success) {
        console.log(`[REALTIME_VOICE] Conversion ${enabled ? 'enabled' : 'disabled'} for call ${callSid}`);
        res.json({ 
          message: `Voice conversion ${enabled ? 'enabled' : 'disabled'}`, 
          callSid, 
          enabled 
        });
      } else {
        res.status(404).json({ message: "Call session not found" });
      }
    } catch (error) {
      console.error('[REALTIME_VOICE] Error toggling conversion:', error);
      res.status(500).json({ message: "Failed to toggle voice conversion", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Get voice conversion status for a call
  app.get("/api/voice/status/:callSid", (req, res) => {
    try {
      const { callSid } = req.params;
      
      const enabled = realtimeVoiceService.isConversionEnabled(callSid);
      const stats = realtimeVoiceService.getSessionStats();
      
      res.json({ 
        callSid, 
        enabled,
        stats
      });
    } catch (error) {
      console.error('[REALTIME_VOICE] Error getting status:', error);
      res.status(500).json({ message: "Failed to get voice conversion status", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Get available voices for conversion
  app.get("/api/voice/conversion-voices", async (req, res) => {
    try {
      const voices = await voiceConversionService.getAvailableVoices();
      res.json(voices);
    } catch (error) {
      console.error('[VOICE_CONVERSION] Error fetching conversion voices:', error);
      res.status(500).json({ message: "Failed to fetch conversion voices", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Get settings
  app.get("/api/settings", (req, res) => {
    try {
      const settings = queries.getAllSettings.all();
      const settingsObj = settings.reduce((acc: any, setting: any) => {
        acc[setting.key] = setting.value;
        return acc;
      }, {});
      
      res.json(settingsObj);
    } catch (error) {
      console.error('[SETTINGS] Error getting settings:', error);
      res.status(500).json({ message: "Failed to get settings", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Update settings
  app.post("/api/settings", (req, res) => {
    try {
      const settings = req.body;
      
      for (const [key, value] of Object.entries(settings)) {
        queries.setSetting.run(key, value);
      }
      
      console.log('[SETTINGS] Updated settings:', Object.keys(settings));
      res.json({ message: "Settings updated", keys: Object.keys(settings) });
    } catch (error) {
      console.error('[SETTINGS] Error updating settings:', error);
      res.status(500).json({ message: "Failed to update settings", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // === METRICS ROUTE ===

  // SSE endpoint for real-time metrics
  app.get("/api/metrics", (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    const sendMetrics = () => {
      const latency = elevenLabsService.getAverageLatency();
      const data = {
        latency,
        activeCalls: activeCalls.size,
        activeRecordings: activeRecordings.size,
        timestamp: Date.now()
      };
      
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Send initial metrics
    sendMetrics();

    // Send metrics every 2 seconds
    const interval = setInterval(sendMetrics, 2000);

    req.on('close', () => {
      clearInterval(interval);
    });
  });

  // === WEBSOCKET HEARTBEAT ===

  // Heartbeat to keep WS alive in Replit
  setInterval(() => {
    captionsWss.clients.forEach((ws: any) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      try { 
        ws.ping(); 
      } catch (e) {
        // Ignore ping errors
      }
    });
  }, 25000);

  // === FAVORITES ROUTES ===

  // List favorites
  app.get("/api/favorites", (req, res) => {
    try {
      const favorites = queries.getAllFavorites.all();
      res.json(favorites);
    } catch (error) {
      console.error('[FAVORITES] Error listing favorites:', error);
      res.status(500).json({ message: "Failed to list favorites", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Add favorite
  app.post("/api/favorites/add", (req, res) => {
    try {
      const { name, phone_e164, voice_type = 'masc' } = req.body;
      
      if (!name || !phone_e164) {
        return res.status(400).json({ message: "name and phone_e164 are required" });
      }

      queries.addFavorite.run(name, phone_e164, voice_type);
      
      console.log(`[FAVORITES] Added favorite: ${name} - ${phone_e164} (${voice_type})`);
      res.json({ message: "Favorite added", name, phone_e164, voice_type });
    } catch (error) {
      console.error('[FAVORITES] Error adding favorite:', error);
      res.status(500).json({ message: "Failed to add favorite", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Remove favorite
  app.post("/api/favorites/remove", (req, res) => {
    try {
      const { id } = req.body;
      
      if (!id) {
        return res.status(400).json({ message: "id is required" });
      }

      queries.removeFavorite.run(id);
      
      console.log(`[FAVORITES] Removed favorite with ID: ${id}`);
      res.json({ message: "Favorite removed", id });
    } catch (error) {
      console.error('[FAVORITES] Error removing favorite:', error);
      res.status(500).json({ message: "Failed to remove favorite", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // === TWILIO CALLBACK ROUTES ===

  // Twilio recording status callback
  app.post("/twilio/recording-status", (req, res) => {
    console.log('[TWILIO] Recording status callback:', req.body);
    res.status(200).send('OK');
  });

  // Twilio call status callback
  app.post("/twilio/call-status", (req, res) => {
    console.log('[TWILIO] Call status callback:', req.body);
    res.status(200).send('OK');
  });

  console.log(`[TELEPHONY] WebSocket servers initialized on ${captionsPath} and ${mediaPath}`);
  return { captionsWss, mediaWss };
}
