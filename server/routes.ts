import type { Express } from "express";
import { createServer } from "http";
import { queries } from "./database";
import { initDatabase } from "./database";
import twilio from "twilio";
import express from "express";
import fetch from "node-fetch";
import multer from "multer";
import { promises as fs } from "fs";
import path from "path";
import { ProviderFactory } from "./providers/providerFactory";

// Environment variables
const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_NUMBER,
  ELEVENLABS_API_KEY
} = process.env;

export async function registerRoutes(app: Express) {
  // Initialize database
  initDatabase();
  
  // TwiML e rotas de telefonia são fornecidas por setupTelephony em server/index.ts

  // Twilio callback routes
  app.post('/twilio/recording-status',(req,res)=>{
    console.log('[recording-status]', req.body || {});
    res.sendStatus(200);
  });

  app.post("/twilio/call-status", (req, res) => {
    console.log('[call-status]', req.body || {});
    res.sendStatus(200);
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      port: process.env.PORT || 5000,
      services: {
        database: 'ok',
        elevenlabs: process.env.ELEVENLABS_API_KEY ? 'configured' : 'not_configured',
        twilio: process.env.TWILIO_ACCOUNT_SID ? 'configured' : 'not_configured'
      }
    });
  });

  // Discagem é tratada por server/telephony.ts
  
  // === SETUP/VALIDATION ROUTES ===

  // Get current API keys status
  app.get("/api/setup/keys", async (req, res) => {
    try {
      const hasElevenLabs = !!(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_API_KEY.length > 10);
      const hasTwilio = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_NUMBER);
      
      res.json({
        success: true,
        configured: {
          elevenlabs: hasElevenLabs,
          twilio: hasTwilio,
          complete: hasElevenLabs && hasTwilio
        },
        keys: {
          ELEVENLABS_API_KEY: hasElevenLabs ? `${process.env.ELEVENLABS_API_KEY?.substring(0, 8)}...` : null,
          TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID ? `${process.env.TWILIO_ACCOUNT_SID?.substring(0, 10)}...` : null,
          TWILIO_NUMBER: process.env.TWILIO_NUMBER || null
        }
      });
    } catch (error) {
      console.error('[SETUP] Error checking keys status:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erro ao verificar status das chaves' 
      });
    }
  });

  // Setup API keys validation endpoint
  app.post("/api/setup/keys", async (req, res) => {
    try {
      const { ELEVENLABS_API_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_NUMBER } = req.body;
      
      console.log('[SETUP] Validating API keys...');
      
      // Basic format validation first
      if (!ELEVENLABS_API_KEY || ELEVENLABS_API_KEY.length < 32) {
        return res.status(400).json({ 
          success: false, 
          message: 'Chave ElevenLabs inválida'
        });
      }
      
      if (!TWILIO_ACCOUNT_SID || !TWILIO_ACCOUNT_SID.startsWith('AC')) {
        return res.status(400).json({ 
          success: false, 
          message: 'Twilio Account SID inválido. Deve começar com "AC"'
        });
      }
      
      if (!TWILIO_AUTH_TOKEN || TWILIO_AUTH_TOKEN.length < 32) {
        return res.status(400).json({ 
          success: false, 
          message: 'Twilio Auth Token inválido. Deve ter pelo menos 32 caracteres'
        });
      }
      
      if (!TWILIO_NUMBER || !TWILIO_NUMBER.startsWith('+')) {
        return res.status(400).json({ 
          success: false, 
          message: 'Número Twilio inválido. Deve começar com "+"'
        });
      }

      // Test ElevenLabs API
      try {
        const elevenResponse = await fetch('https://api.elevenlabs.io/v1/voices', {
          headers: { 'xi-api-key': ELEVENLABS_API_KEY }
        });
        
        if (!elevenResponse.ok) {
          return res.status(400).json({ 
            success: false, 
            message: 'Chave ElevenLabs inválida - falha na autenticação'
          });
        }
      } catch (error) {
        return res.status(400).json({ 
          success: false, 
          message: 'Erro ao validar chave ElevenLabs'
        });
      }

      // Test Twilio API  
      try {
        const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
        await client.api.accounts(TWILIO_ACCOUNT_SID).fetch();
      } catch (error) {
        return res.status(400).json({ 
          success: false, 
          message: 'Credenciais Twilio inválidas'
        });
      }

      console.log('[SETUP] All API keys validated successfully');
      res.json({ success: true, message: 'Todas as chaves foram validadas com sucesso!' });
    } catch (error) {
      console.error('[SETUP] Error validating keys:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erro interno do servidor'
      });
    }
  });

  // Validate single key endpoint
  app.post("/api/validate-keys", async (req, res) => {
    try {
      const keys = req.body;
      const results = {
        elevenlabs: false,
        twilio: false,
        overall: false
      };

      // Validate ElevenLabs
      if (keys.ELEVENLABS_API_KEY) {
        try {
          const response = await fetch('https://api.elevenlabs.io/v1/voices', {
            headers: { 'xi-api-key': keys.ELEVENLABS_API_KEY }
          });
          results.elevenlabs = response.ok;
        } catch (error) {
          console.error('ElevenLabs validation error:', error);
        }
      }

      // Validate Twilio
      if (keys.TWILIO_ACCOUNT_SID && keys.TWILIO_AUTH_TOKEN) {
        try {
          const client = twilio(keys.TWILIO_ACCOUNT_SID, keys.TWILIO_AUTH_TOKEN);
          await client.api.accounts(keys.TWILIO_ACCOUNT_SID).fetch();
          results.twilio = true;
        } catch (error) {
          console.error('Twilio validation error:', error);
        }
      }

      results.overall = results.elevenlabs && results.twilio;
      res.json(results);
    } catch (error) {
      console.error('Key validation error:', error);
      res.status(500).json({ error: 'Failed to validate keys' });
    }
  });

  // === CALL CONTROL ROUTES ===

  // Store active calls with their providers
  const activeCallProviders = new Map<string, any>();

  // Dial endpoint
  app.post("/api/call/dial", async (req, res) => {
    try {
      const { to, voipNumberId, voiceType } = req.body;
      
      if (!to) {
        return res.status(400).json({ error: "Phone number 'to' is required" });
      }

      console.log(`[CALL] Initiating call to ${to}`);
      
      // Get the appropriate provider based on VoIP number
      const { provider, voipNumber } = ProviderFactory.getProviderForCall(voipNumberId);
      
      console.log(`[CALL] Using ${voipNumber.provider} provider (${voipNumber.name})`);
      console.log(`[CALL] From: ${voipNumber.number} → To: ${to}`);
      
      // Start the call
      const result = await provider.startCall(to, voiceType || 'masc');
      
      // Store the provider for this call
      activeCallProviders.set(result.callId, provider);
      
      res.json({
        success: true,
        message: `Calling ${to} via ${voipNumber.provider}...`,
        callId: result.callId,
        callSid: result.callId,
        status: result.status,
        provider: voipNumber.provider,
        fromNumber: voipNumber.number
      });
    } catch (error) {
      console.error('[CALL] Error dialing:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : String(error),
        success: false
      });
    }
  });

  // Hangup endpoint
  app.post("/api/call/hangup", async (req, res) => {
    try {
      const { callSid } = req.body;
      
      if (!callSid) {
        return res.status(400).json({ error: "Call SID is required" });
      }

      console.log(`[CALL] Hanging up call ${callSid}`);
      
      // Get the provider for this call
      const provider = activeCallProviders.get(callSid);
      
      if (!provider) {
        console.warn(`[CALL] No provider found for call ${callSid}, using default`);
        // Try to get default provider as fallback
        const { provider: defaultProvider } = ProviderFactory.getProviderForCall();
        await defaultProvider.hangup(callSid);
      } else {
        await provider.hangup(callSid);
        activeCallProviders.delete(callSid);
      }
      
      res.json({
        success: true,
        message: 'Call ended',
        status: 'ended'
      });
    } catch (error) {
      console.error('[CALL] Error hanging up:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  // DTMF endpoint
  app.post("/api/call/dtmf", async (req, res) => {
    try {
      const { callSid, digits } = req.body;
      
      if (!callSid || !digits) {
        return res.status(400).json({ error: "Call SID and digits are required" });
      }

      console.log(`[CALL] Sending DTMF ${digits} to call ${callSid}`);
      
      const provider = activeCallProviders.get(callSid);
      
      if (!provider) {
        throw new Error('No active provider for this call');
      }
      
      await provider.sendDTMF(callSid, digits);
      
      res.json({
        success: true,
        message: `DTMF ${digits} sent`
      });
    } catch (error) {
      console.error('[CALL] Error sending DTMF:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  // === FAVORITES ROUTES ===

  // Get favorites
  app.get("/api/favorites", (req, res) => {
    try {
      const favorites = queries.getAllFavorites.all();
      res.json(favorites);
    } catch (error) {
      console.error('[FAVORITES] Error getting favorites:', error);
      res.status(500).json({ message: "Failed to get favorites", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Add favorite
  app.post("/api/favorites", (req, res) => {
    try {
      const { name, phoneNumber, voiceType } = req.body;
      
      if (!name || !phoneNumber) {
        return res.status(400).json({ error: "Name and phone number are required" });
      }

      queries.addFavorite.run(name, phoneNumber, voiceType || 'masculine');
      const favorites = queries.getAllFavorites.all();
      const favorite = favorites[favorites.length - 1];
      
      console.log(`[FAVORITES] Added favorite: ${name} - ${phoneNumber}`);
      res.json(favorite);
    } catch (error) {
      console.error('[FAVORITES] Error adding favorite:', error);
      res.status(500).json({ message: "Failed to add favorite", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // === VOIP NUMBERS ROUTES ===

  // Get all VoIP numbers (WITHOUT sensitive credentials)
  app.get("/api/voip-numbers", (req, res) => {
    try {
      const numbers = queries.getAllVoipNumbers.all() as any[];
      
      // Remove sensitive fields before sending to client
      const safeNumbers = numbers.map(num => ({
        id: num.id,
        name: num.name,
        number: num.number,
        provider: num.provider,
        sip_username: num.sip_username,
        sip_server: num.sip_server,
        is_default: num.is_default,
        status: num.status,
        created_at: num.created_at,
        updated_at: num.updated_at
        // sip_password is intentionally omitted for security
      }));
      
      res.json(safeNumbers);
    } catch (error) {
      console.error('[VOIP_NUMBERS] Error getting numbers:', error);
      res.status(500).json({ message: "Failed to get VoIP numbers", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Get default VoIP number
  app.get("/api/voip-numbers/default", (req, res) => {
    try {
      const defaultNumber = queries.getDefaultVoipNumber.get();
      res.json(defaultNumber || null);
    } catch (error) {
      console.error('[VOIP_NUMBERS] Error getting default number:', error);
      res.status(500).json({ message: "Failed to get default VoIP number", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Add VoIP number (passwords NOT stored - must be in environment)
  app.post("/api/voip-numbers", (req, res) => {
    try {
      const { name, number, provider, sipUsername, sipServer, isDefault } = req.body;
      
      if (!name || !number || !provider) {
        return res.status(400).json({ error: "Name, number and provider are required" });
      }

      // SECURITY: Never store passwords in database
      // Passwords must be configured as environment variables
      // For SobreIP: use SOBREIP_PASSWORD environment variable
      
      if (provider.toLowerCase() === 'sobreip') {
        if (!process.env.SOBREIP_PASSWORD) {
          return res.status(400).json({ 
            error: "SobreIP password must be configured in SOBREIP_PASSWORD environment variable" 
          });
        }
      }

      // If this is marked as default, unset any other default
      if (isDefault) {
        queries.setDefaultVoipNumber.run(-1); // Unset all defaults first
      }

      const info = queries.addVoipNumber.run(
        name, 
        number, 
        provider, 
        sipUsername || null, 
        null, // Never store password in DB
        sipServer || null, 
        isDefault ? 1 : 0,
        'active'
      );
      
      const newNumber = queries.getVoipNumberById.get(info.lastInsertRowid) as any;
      
      // Remove sensitive fields before sending to client
      const safeNumber = {
        id: newNumber.id,
        name: newNumber.name,
        number: newNumber.number,
        provider: newNumber.provider,
        sip_username: newNumber.sip_username,
        sip_server: newNumber.sip_server,
        is_default: newNumber.is_default,
        status: newNumber.status,
        created_at: newNumber.created_at,
        updated_at: newNumber.updated_at
      };
      
      console.log(`[VOIP_NUMBERS] Added number: ${name} - ${number} (${provider})`);
      res.json(safeNumber);
    } catch (error) {
      console.error('[VOIP_NUMBERS] Error adding number:', error);
      res.status(500).json({ message: "Failed to add VoIP number", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Set default VoIP number
  app.put("/api/voip-numbers/:id/default", (req, res) => {
    try {
      const { id } = req.params;
      
      queries.setDefaultVoipNumber.run(parseInt(id));
      const updatedNumber = queries.getVoipNumberById.get(parseInt(id));
      
      console.log(`[VOIP_NUMBERS] Set default number: ${id}`);
      res.json(updatedNumber);
    } catch (error) {
      console.error('[VOIP_NUMBERS] Error setting default:', error);
      res.status(500).json({ message: "Failed to set default VoIP number", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Delete VoIP number
  app.delete("/api/voip-numbers/:id", (req, res) => {
    try {
      const { id } = req.params;
      
      queries.deleteVoipNumber.run(parseInt(id));
      
      console.log(`[VOIP_NUMBERS] Deleted number: ${id}`);
      res.json({ success: true });
    } catch (error) {
      console.error('[VOIP_NUMBERS] Error deleting number:', error);
      res.status(500).json({ message: "Failed to delete VoIP number", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // === SETTINGS ROUTES ===

  // Get settings
  app.get("/api/settings", (req, res) => {
    try {
      const allSettings = queries.getAllSettings.all() as any[];
      const settings = allSettings.length > 0 ? allSettings[0] : {
        id: 1,
        voice_type: 'masculine',
        auto_record: false,
        noise_reduction: true,
        echo_cancellation: true
      };
      res.json(settings);
    } catch (error) {
      console.error('[SETTINGS] Error getting settings:', error);
      res.status(500).json({ message: "Failed to get settings", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Update settings
  app.put("/api/settings", (req, res) => {
    try {
      const { voice_type, auto_record, noise_reduction, echo_cancellation } = req.body;
      
      queries.setSetting.run('voice_type', voice_type || 'masculine');
      queries.setSetting.run('auto_record', auto_record || false);
      queries.setSetting.run('noise_reduction', noise_reduction || true);
      queries.setSetting.run('echo_cancellation', echo_cancellation || true);
      
      const allSettings = queries.getAllSettings.all() as any[];
      const settings = allSettings.length > 0 ? allSettings[0] : {
        voice_type: voice_type || 'masculine',
        auto_record: auto_record || false,
        noise_reduction: noise_reduction || true,
        echo_cancellation: echo_cancellation || true
      };
      console.log('[SETTINGS] Settings updated:', settings);
      res.json(settings);
    } catch (error) {
      console.error('[SETTINGS] Error updating settings:', error);
      res.status(500).json({ message: "Failed to update settings", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // === RECORDINGS ROUTES ===

  // List recordings
  app.get("/api/recordings/list", async (req, res) => {
    try {
      const recordings = queries.getAllRecordings.all();
      res.json(recordings);
    } catch (error) {
      console.error('[RECORDING] Error listing recordings:', error);
      res.status(500).json({ message: "Failed to list recordings", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Start recording  
  app.post("/api/recordings/start", async (req, res) => {
    try {
      const { callSid, phoneNumber } = req.body;
      
      console.log(`[RECORDING] Starting recording for call: ${callSid || 'demo'}`);

      const timestamp = Date.now();
      const filename = `call-${phoneNumber || 'unknown'}-${timestamp}.wav`;
      
      queries.addRecording.run(callSid || `demo-${timestamp}`, phoneNumber || 'unknown', filename);
      const recordings = queries.getAllRecordings.all();
      const recordingDb = recordings[recordings.length - 1] as any;
      
      console.log(`[RECORDING] Recording started: ${filename}`);
      res.json({ 
        success: true, 
        id: recordingDb.id, 
        filename, 
        callSid: callSid || `demo-${timestamp}`,
        status: 'recording'
      });
    } catch (error) {
      console.error('[RECORDING] Error starting recording:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Pause recording
  app.post("/api/recordings/:id/pause", async (req, res) => {
    try {
      const { id } = req.params;
      const recordingId = parseInt(id);
      
      console.log(`[RECORDING] Pausing recording ${recordingId}`);
      
      res.json({ 
        success: true, 
        id: recordingId,
        status: 'paused',
        message: "Recording paused successfully" 
      });
    } catch (error) {
      console.error('[RECORDING] Error pausing recording:', error);
      res.status(500).json({ message: "Failed to pause recording", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Resume recording
  app.post("/api/recordings/:id/resume", async (req, res) => {
    try {
      const { id } = req.params;
      const recordingId = parseInt(id);
      
      console.log(`[RECORDING] Resuming recording ${recordingId}`);
      
      res.json({ 
        success: true, 
        id: recordingId,
        status: 'recording',
        message: "Recording resumed successfully" 
      });
    } catch (error) {
      console.error('[RECORDING] Error resuming recording:', error);
      res.status(500).json({ message: "Failed to resume recording", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Stop recording
  app.post("/api/recordings/:id/stop", async (req, res) => {
    try {
      const { id } = req.params;
      const recordingId = parseInt(id);
      
      const recording = queries.getRecordingById.get(recordingId);
      if (!recording) {
        return res.status(404).json({ message: "Recording not found" });
      }

      // Create demo audio file
      const { existsSync, mkdirSync, writeFileSync, statSync } = await import('fs');
      const { join } = await import('path');
      
      const recordingsDir = join(process.cwd(), 'recordings');
      if (!existsSync(recordingsDir)) {
        mkdirSync(recordingsDir, { recursive: true });
      }

      const filePath = join(recordingsDir, (recording as any).filename);
      
      // Generate a simple WAV file
      const duration = 10; // 10 seconds
      const sampleRate = 44100;
      const channels = 1;
      const bitsPerSample = 16;
      const blockAlign = channels * bitsPerSample / 8;
      const byteRate = sampleRate * blockAlign;
      const dataSize = duration * byteRate;
      const fileSize = 36 + dataSize;

      const buffer = Buffer.alloc(44 + dataSize);
      
      // WAV header
      buffer.write('RIFF', 0);
      buffer.writeUInt32LE(fileSize, 4);
      buffer.write('WAVE', 8);
      buffer.write('fmt ', 12);
      buffer.writeUInt32LE(16, 16);
      buffer.writeUInt16LE(1, 20);
      buffer.writeUInt16LE(channels, 22);
      buffer.writeUInt32LE(sampleRate, 24);
      buffer.writeUInt32LE(byteRate, 28);
      buffer.writeUInt16LE(blockAlign, 32);
      buffer.writeUInt16LE(bitsPerSample, 34);
      buffer.write('data', 36);
      buffer.writeUInt32LE(dataSize, 40);
      
      // Generate 440Hz tone  
      for (let i = 0; i < dataSize / 2; i++) {
        const sample = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 16000;
        buffer.writeInt16LE(Math.floor(sample), 44 + i * 2);
      }
      
      writeFileSync(filePath, buffer);
      const stats = statSync(filePath);
      
      queries.updateRecording.run(duration, stats.size, recordingId);
      
      console.log(`[RECORDING] Stopped recording ${recordingId}: ${(recording as any).filename}`);
      res.json({ success: true, id: recordingId, duration, size: stats.size });
    } catch (error) {
      console.error('[RECORDING] Error stopping recording:', error);
      res.status(500).json({ message: "Failed to stop recording", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Download recording
  app.get("/api/recordings/:id/download", async (req, res) => {
    try {
      const { id } = req.params;
      const recordingId = parseInt(id);
      
      const recording = queries.getRecordingById.get(recordingId);
      if (!recording || !(recording as any).filename) {
        return res.status(404).json({ message: "Recording not found" });
      }

      const { join } = await import('path');
      const { existsSync, statSync } = await import('fs');
      
      const filePath = join(process.cwd(), 'recordings', (recording as any).filename);
      
      if (!existsSync(filePath)) {
        return res.status(404).json({ message: "Recording file not found" });
      }

      const stats = statSync(filePath);
      
      res.set({
        'Content-Type': 'audio/wav',
        'Content-Disposition': `attachment; filename="${(recording as any).filename}"`,
        'Content-Length': stats.size
      });
      
      const { createReadStream } = await import('fs');
      const fileStream = createReadStream(filePath);
      fileStream.pipe(res);
      
      console.log(`[RECORDING] Downloaded recording ${recordingId}: ${(recording as any).filename}`);
    } catch (error) {
      console.error('[RECORDING] Error downloading recording:', error);
      res.status(500).json({ message: "Failed to download recording", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Delete recording
  app.delete("/api/recordings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const recordingId = parseInt(id);
      
      const recording = queries.getRecordingById.get(recordingId);
      if (!recording) {
        return res.status(404).json({ message: "Recording not found" });
      }

      // Delete file from disk
      const { join } = await import('path');
      const { existsSync, unlinkSync } = await import('fs');
      
      const filePath = join(process.cwd(), 'recordings', (recording as any).filename);
      
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }

      // Delete from database
      queries.deleteRecording.run(recordingId);
      
      console.log(`[RECORDING] Deleted recording ${recordingId}: ${(recording as any).filename}`);
      res.json({ success: true, message: "Recording deleted successfully" });
    } catch (error) {
      console.error('[RECORDING] Error deleting recording:', error);
      res.status(500).json({ message: "Failed to delete recording", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Voice recommendations endpoint
  app.get('/api/voices/recommended', async (req, res) => {
    try {
      const recommended = {
        masc: [
          'pNInz6obpgDQGcFmaJgB', // Adam - voz masculina natural
          'VR6AewLTigWG4xSOukaG', // Arnold - profundo e natural  
          'ErXwobaYiN019PkySvjV', // Antoni - caloroso
          'yoZ06aMxZJJ28mfd3POQ', // Sam - jovem e energético
          'jsCqWAovK2LkecY7zXl4'  // Matheus - português brasileiro
        ],
        fem: [
          'EXAVITQu4vr4xnSDxMaL', // Bella - feminina suave
          'AZnzlk1XvdvUeBnXmlld', // Domi - expressiva
          'TxGEqnHWrfWFTfGW9XjX', // Josh - versátil
          'pFZP5JQG7iQjIQuC4Bku', // Lily - jovem e clara
          'CwhRBWXzGAHq8TQ4Fs17'  // Serena - brasileira natural
        ]
      };
      
      res.json({
        message: 'Vozes otimizadas para soar mais naturais',
        voices: recommended
      });
    } catch (error) {
      console.error('[VOICES] Error getting recommended voices:', error);
      res.status(500).json({ message: "Failed to get recommended voices" });
    }
  });

  // SobreIP webhook endpoint for call events
  app.post('/events', (req, res) => {
    try {
      const event = req.body;
      console.log('[SOBREIP_EVENTS] Call event received:', JSON.stringify(event, null, 2));
      
      // Process call events from SobreIP
      if (event.event) {
        switch (event.event) {
          case 'call.initiated':
            console.log('[SOBREIP_EVENTS] Call initiated:', event.call_id);
            break;
          case 'call.ringing':
            console.log('[SOBREIP_EVENTS] Call ringing:', event.call_id);
            break;
          case 'call.answered':
            console.log('[SOBREIP_EVENTS] Call answered:', event.call_id);
            break;
          case 'call.ended':
            console.log('[SOBREIP_EVENTS] Call ended:', event.call_id, 'Duration:', event.duration);
            break;
          default:
            console.log('[SOBREIP_EVENTS] Unknown event:', event.event);
        }
      }
      
      res.status(200).json({ success: true, message: 'Event received' });
    } catch (error) {
      console.error('[SOBREIP_EVENTS] Error processing event:', error);
      res.status(500).json({ success: false, message: 'Failed to process event' });
    }
  });

  // Voice test endpoint - generate audio sample
  app.post('/api/voices/test', async (req, res) => {
    try {
      const { voiceId, text } = req.body;
      
      if (!voiceId || !text) {
        return res.status(400).json({ error: 'voiceId and text are required' });
      }

      const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
      if (!ELEVENLABS_API_KEY) {
        return res.status(500).json({ error: 'ElevenLabs API key not configured' });
      }

      console.log(`[VOICE_TEST] Generating audio for voice ${voiceId}`);

      // Call ElevenLabs TTS API
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8,
            style: 0.0,
            use_speaker_boost: true
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[VOICE_TEST] ElevenLabs API error:', response.status, errorText);
        return res.status(response.status).json({ error: 'Failed to generate audio' });
      }

      // Stream the audio response
      const audioBuffer = await response.buffer();
      
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString()
      });
      
      res.send(audioBuffer);
      console.log(`[VOICE_TEST] Audio generated successfully (${audioBuffer.length} bytes)`);

    } catch (error) {
      console.error('[VOICE_TEST] Error generating voice test:', error);
      res.status(500).json({ error: 'Failed to generate voice test' });
    }
  });

  console.log('[ROUTES] API routes configured');
}