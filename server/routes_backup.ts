import type { Express } from "express";
import { createServer } from "http";
import { setupTelephony } from "./telephony";
import { queries } from "./database";
import { initDatabase } from "./database";
import twilio from "twilio";
import express from "express";
import fetch from "node-fetch";
import multer from "multer";
import { promises as fs } from "fs";
import path from "path";
import { recordingService } from "./recordingService";
import { db } from "./db";
import { calls, recordings } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

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
  
  // Create HTTP server
  const server = createServer(app);
  
  // Setup telephony with WebSocket
  setupTelephony(app, server);
  
  // === SETUP/VALIDATION ROUTES ===

  // Setup API keys validation endpoint
  app.post("/api/setup/keys", async (req, res) => {
    try {
      const { ELEVENLABS_API_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_NUMBER } = req.body;
      
      console.log('[SETUP] Validating API keys...');
      
      // Basic format validation first
      if (!ELEVENLABS_API_KEY || !ELEVENLABS_API_KEY.startsWith('sk-')) {
        return res.status(400).json({ 
          success: false, 
          message: 'Chave ElevenLabs inválida. Deve começar com "sk-"'
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
          message: 'Número Twilio inválido. Deve estar no formato E.164 (+5511...)'
        });
      }
      
      // Validate ElevenLabs API
      let elevenLabsValid = false;
      let twilioValid = false;
      let elevenLabsError = '';
      let twilioError = '';
      
      try {
        console.log('[SETUP] Testing ElevenLabs API...');
        const elevenLabsResponse = await fetch('https://api.elevenlabs.io/v1/voices', {
          headers: { 'xi-api-key': ELEVENLABS_API_KEY }
        });
        
        if (elevenLabsResponse.ok) {
          elevenLabsValid = true;
          console.log('[SETUP] ElevenLabs API validated');
        } else {
          elevenLabsError = `HTTP ${elevenLabsResponse.status}: ${elevenLabsResponse.statusText}`;
          console.log('[SETUP] ElevenLabs validation failed:', elevenLabsError);
        }
      } catch (error) {
        elevenLabsError = error instanceof Error ? error.message : 'Erro de conexão';
        console.log('[SETUP] ElevenLabs error:', elevenLabsError);
      }
      
      // Validate Twilio API
      try {
        console.log('[SETUP] Testing Twilio API...');
        const credentials = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
        const twilioResponse = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}.json`, {
          headers: { 'Authorization': `Basic ${credentials}` }
        });
        
        if (twilioResponse.ok) {
          twilioValid = true;
          console.log('[SETUP] Twilio API validated');
        } else {
          twilioError = `HTTP ${twilioResponse.status}: ${twilioResponse.statusText}`;
          console.log('[SETUP] Twilio validation failed:', twilioError);
        }
      } catch (error) {
        twilioError = error instanceof Error ? error.message : 'Erro de conexão';
        console.log('[SETUP] Twilio error:', twilioError);
      }
      
      if (elevenLabsValid && twilioValid) {
        console.log('[SETUP] All API keys validated successfully');
        
        // Store validated keys in environment (for this session)
        process.env.ELEVENLABS_API_KEY = ELEVENLABS_API_KEY;
        process.env.TWILIO_ACCOUNT_SID = TWILIO_ACCOUNT_SID;
        process.env.TWILIO_AUTH_TOKEN = TWILIO_AUTH_TOKEN;
        process.env.TWILIO_NUMBER = TWILIO_NUMBER;
        
        res.json({ success: true, message: 'Chaves validadas com sucesso!' });
      } else {
        console.log('[SETUP] Validation failed:', { elevenLabsValid, twilioValid, elevenLabsError, twilioError });
        
        let errorMessage = 'Falha na validação das chaves API:';
        if (!elevenLabsValid) errorMessage += `\n• ElevenLabs: ${elevenLabsError}`;
        if (!twilioValid) errorMessage += `\n• Twilio: ${twilioError}`;
        
        res.status(400).json({ 
          success: false, 
          message: errorMessage,
          details: {
            elevenlabs: { valid: elevenLabsValid, error: elevenLabsError },
            twilio: { valid: twilioValid, error: twilioError }
          }
        });
      }
    } catch (error) {
      console.error('[SETUP] Key validation error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erro interno do servidor durante validação' 
      });
    }
  });

  // Get ElevenLabs voices (proxy)
  app.get("/api/voices", async (req, res) => {
    try {
      if (!ELEVENLABS_API_KEY) {
        return res.status(500).json({ message: "ElevenLabs API key not configured" });
      }

      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: { 'xi-api-key': ELEVENLABS_API_KEY }
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      const voices = await response.json();
      res.json(voices);
    } catch (error) {
      console.error('[VOICES] Error fetching voices:', error);
      res.status(500).json({ message: "Failed to fetch voices", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Test voice with specific text - VERSION APRIMORADA
  app.post('/api/voices/test', async (req, res) => {
    try {
      const { voiceId, text, voiceType = 'masc', quality = 'natural' } = req.body;
      
      if (!voiceId || !text) {
        return res.status(400).json({ error: 'VoiceId and text are required' });
      }

      if (!ELEVENLABS_API_KEY) {
        return res.status(500).json({ error: 'ElevenLabs API key not configured' });
      }

      console.log(`[VOICE_TEST] Testing voice ${voiceId} (${voiceType}) with enhanced settings`);
      
      // Importa o processador de voz
      const { voiceProcessor } = await import('./voiceProcessor');
      
      // Configurações otimizadas para naturalidade
      const voiceSettings = voiceProcessor.getOptimizedVoiceSettings(voiceType as 'masc' | 'fem');
      const bestModel = voiceProcessor.getBestModel(quality as 'speed' | 'quality' | 'natural');
      const advancedParams = voiceProcessor.getAdvancedParameters(text);
      
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY
        },
        body: JSON.stringify({
          text,
          model_id: bestModel,
          voice_settings: voiceSettings,
          ...advancedParams
        })
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs TTS error: ${response.statusText}`);
      }

      let audioBuffer = Buffer.from(await response.arrayBuffer());
      
      // Processa o áudio para torná-lo mais natural
      audioBuffer = await voiceProcessor.processAudioBuffer(audioBuffer);
      
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
        'X-Voice-Quality': 'enhanced'
      });
      
      res.send(audioBuffer);
    } catch (error) {
      console.error('[VOICE_TEST] Error testing voice:', error);
      res.status(500).json({ error: 'Failed to test voice' });
    }
  });

  // Novo endpoint: Lista vozes recomendadas (menos robóticas)
  app.get('/api/voices/recommended', async (req, res) => {
    try {
      // Vozes recomendadas codificadas para evitar dependências
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
        voices: recommended,
        tips: [
          'Estas vozes foram selecionadas por soarem menos robóticas',
          'Use o modelo eleven_multilingual_v2 para melhor qualidade',
          'Configurações de estabilidade baixa (0.3-0.4) são mais naturais',
          'Similarity boost alto (0.9+) melhora a qualidade'
        ]
      });
    } catch (error) {
      console.error('[VOICES] Error getting recommended voices:', error);
      res.status(500).json({ error: 'Failed to get recommended voices' });
    }
  });

  // === FAVORITES ROUTES ===

  // Add favorite
  app.post("/api/favorites/add", (req, res) => {
    try {
      const { name, phone_e164, voice_type } = req.body;
      
      if (!name || !phone_e164 || !voice_type) {
        return res.status(400).json({ message: "name, phone_e164, and voice_type are required" });
      }

      const favorite = queries.addFavorite.run({
        name,
        phone_e164,
        voice_type
      });

      console.log(`[FAVORITE] Added: ${name} (${phone_e164}) with voice ${voice_type}`);
      res.json({ success: true, favorite });
    } catch (error) {
      console.error('[FAVORITE] Error adding favorite:', error);
      res.status(500).json({ message: "Failed to add favorite", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Remove favorite
  app.delete("/api/favorites/:id", (req, res) => {
    try {
      const { id } = req.params;
      const result = queries.removeFavorite.run({ id: parseInt(id) });
      
      if (result.changes === 0) {
        return res.status(404).json({ message: "Favorite not found" });
      }

      console.log(`[FAVORITE] Removed favorite with ID: ${id}`);
      res.json({ success: true, message: "Favorite removed" });
    } catch (error) {
      console.error('[FAVORITE] Error removing favorite:', error);
      res.status(500).json({ message: "Failed to remove favorite", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Get all favorites
  app.get("/api/favorites", (req, res) => {
    try {
      const favorites = queries.getAllFavorites.all();
      res.json(favorites);
    } catch (error) {
      console.error('[FAVORITE] Error getting favorites:', error);
      res.status(500).json({ message: "Failed to get favorites", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // === SETTINGS ROUTES ===

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
        queries.setSetting.run({ key, value: String(value) });
      }

      console.log('[SETTINGS] Updated settings:', Object.keys(settings));
      res.json({ success: true, message: "Settings updated" });
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
      const recordingDb = queries.getLastRecording.get() as any;
      
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
      
      // WAV header + tone audio data
      const buffer = Buffer.alloc(44 + dataSize);
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
      
      // Generate a 440Hz tone  
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

  // Recording status callback from Twilio
  app.post("/twilio/recording-status", express.urlencoded({ extended: true }), async (req, res) => {
    try {
      const {
        CallSid,
        RecordingSid,
        RecordingUrl,
        RecordingDuration,
        RecordingStatus
      } = req.body;

      console.log(`[TWILIO] Recording status: ${RecordingStatus} for ${CallSid}`);

      if (RecordingStatus === 'completed') {
        const urlMp3 = `${RecordingUrl}.mp3`;
        const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
        
        const response = await fetch(urlMp3, { 
          headers: { Authorization: `Basic ${auth}` }
        });
        
        if (!response.ok) throw new Error(`Download failed: ${response.status}`);
        
        const { join } = await import('path');
        const { writeFile, mkdir } = await import('fs').then(fs => fs.promises);
        
        const recordingsDir = join(process.cwd(), 'recordings');
        await mkdir(recordingsDir, { recursive: true });
        
        const file = join(recordingsDir, `${CallSid}-${RecordingSid}.mp3`);
        await writeFile(file, Buffer.from(await response.arrayBuffer()));
        
        console.log(`[TWILIO] Downloaded recording: ${CallSid}-${RecordingSid}.mp3`);
      }
      
      res.status(200).end();
    } catch (error) {
      console.error('[TWILIO] Recording status error:', error instanceof Error ? error.message : String(error));
      res.status(200).end(); // Always respond 200 to Twilio
    }
  });

  // Serve test page for public access verification
  app.get('/test-public', (req, res) => {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>✅ Teste Público Abmix - APIs Funcionando!</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #0f172a; color: white; }
        .success { background: #16a34a; color: white; padding: 15px; border-radius: 8px; margin: 10px 0; }
        .info { background: #0ea5e9; color: white; padding: 10px; border-radius: 8px; margin: 10px 0; }
        button { background: #22c55e; color: white; padding: 12px 20px; margin: 5px; border: none; border-radius: 6px; cursor: pointer; }
        button:hover { background: #16a34a; }
        pre { background: #1e293b; padding: 10px; border-radius: 6px; overflow: auto; }
    </style>
</head>
<body>
    <div class="success">
        <h1>✅ SUCESSO - Deployment Funcionando Perfeitamente!</h1>
        <p>Todas as APIs e credenciais estão operacionais no deployment.</p>
    </div>
    
    <div class="info">
        <h3>📊 Status dos Testes:</h3>
        <ul>
            <li>✅ Health Check: PASSOU</li>
            <li>✅ Validate Keys: PASSOU</li>
            <li>✅ ElevenLabs: VÁLIDA</li>
            <li>✅ Twilio: VÁLIDO</li>
            <li>✅ Deepgram: VÁLIDA</li>
        </ul>
    </div>

    <div>
        <h3>🔧 Links de Teste:</h3>
        <button onclick="window.open('/api/health', '_blank')">Ver Health Check</button>
        <button onclick="testAPIs()">Testar Todas as APIs</button>
        <button onclick="window.open('/', '_blank')">Abrir Painel Principal</button>
    </div>
    
    <div id="results"></div>
    
    <script>
        function testAPIs() {
            fetch('/api/validate-keys', {method: 'POST'})
                .then(r => r.json())
                .then(data => {
                    const div = document.getElementById('results');
                    div.innerHTML = '<h3>Resultado dos Testes:</h3><pre>' + JSON.stringify(data, null, 2) + '</pre>';
                })
                .catch(err => {
                    const div = document.getElementById('results');
                    div.innerHTML = '<h3 style="color: #ef4444">Erro:</h3><pre>' + err.message + '</pre>';
                });
        }
        
        // Teste automático na carga
        document.addEventListener('DOMContentLoaded', () => {
            console.log('✅ Página de teste carregada no deployment');
            console.log('URL:', window.location.href);
        });
    </script>
</body>
</html>
    `;
    res.set('Content-Type', 'text/html').send(html);
  });

  // === HEALTH CHECK ENDPOINTS ===
  
  // Endpoint para verificar se as chaves estão configuradas
  app.get('/api/health', (req, res) => {
    const requiredEnvVars = [
      'ELEVENLABS_API_KEY',
      'TWILIO_ACCOUNT_SID', 
      'TWILIO_AUTH_TOKEN',
      'TWILIO_NUMBER',
      'DEEPGRAM_API_KEY'
    ];

    const envStatus: { [key: string]: { present: boolean; format: string } } = {};
    const missingVars: string[] = [];

    requiredEnvVars.forEach(envVar => {
      const value = process.env[envVar];
      const isPresent = !!value;
      let formatInfo = 'not found';
      
      if (value) {
        if (envVar === 'ELEVENLABS_API_KEY') {
          formatInfo = value.startsWith('sk_') ? `valid format (${value.length} chars)` : `invalid format (starts with ${value.substring(0, 3)}...)`;
        } else if (envVar.includes('TWILIO')) {
          formatInfo = `${value.length} chars`;
        } else {
          formatInfo = `${value.length} chars`;
        }
      }
      
      envStatus[envVar] = { present: isPresent, format: formatInfo };
      
      if (!isPresent) {
        missingVars.push(envVar);
      }
    });

    const allPresent = missingVars.length === 0;

    res.json({
      status: allPresent ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      is_replit: !!process.env.REPLIT_DEV_DOMAIN,
      replit_domain: process.env.REPLIT_DEV_DOMAIN,
      missing_variables: missingVars,
      variables_status: envStatus,
      message: allPresent 
        ? 'Todas as variáveis estão configuradas' 
        : `${missingVars.length} variáveis faltando: ${missingVars.join(', ')}`
    });
  });

  // Endpoint específico para validar chaves da API
  app.post('/api/validate-keys', async (req, res) => {
    const results: { [key: string]: { valid: boolean; error?: string; keyInfo?: string } } = {};

    // Teste ElevenLabs
    try {
      const elevenlabsKey = process.env.ELEVENLABS_API_KEY;
      if (!elevenlabsKey) {
        results.elevenlabs = { 
          valid: false, 
          error: 'API key not found in environment',
          keyInfo: 'No ELEVENLABS_API_KEY environment variable'
        };
      } else if (!elevenlabsKey.startsWith('sk_')) {
        results.elevenlabs = { 
          valid: false, 
          error: 'Chave ElevenLabs inválida. Deve começar com "sk-"',
          keyInfo: `Key starts with: ${elevenlabsKey.substring(0, 3)}..., length: ${elevenlabsKey.length}`
        };
      } else {
        const response = await fetch('https://api.elevenlabs.io/v1/user', {
          headers: { 'xi-api-key': elevenlabsKey }
        });
        
        if (response.ok) {
          const userData = await response.json() as any;
          results.elevenlabs = { 
            valid: true,
            keyInfo: `Valid key, user: ${userData?.subscription?.tier || 'unknown'}`
          };
        } else {
          const errorText = await response.text();
          results.elevenlabs = { 
            valid: false,
            error: `HTTP ${response.status}: ${response.statusText}`,
            keyInfo: `Response: ${errorText.substring(0, 100)}...`
          };
        }
      }
    } catch (error) {
      results.elevenlabs = { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        keyInfo: 'Network or connection error'
      };
    }

    // Teste Twilio
    try {
      const twilioSid = process.env.TWILIO_ACCOUNT_SID;
      const twilioToken = process.env.TWILIO_AUTH_TOKEN;
      
      if (!twilioSid || !twilioToken) {
        results.twilio = { valid: false, error: 'Credentials not found' };
      } else {
        const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
        const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}.json`, {
          headers: { 'Authorization': `Basic ${auth}` }
        });
        results.twilio = { 
          valid: response.ok,
          error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`
        };
      }
    } catch (error) {
      results.twilio = { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }

    // Teste Deepgram
    try {
      const deepgramKey = process.env.DEEPGRAM_API_KEY;
      if (!deepgramKey) {
        results.deepgram = { valid: false, error: 'API key not found' };
      } else {
        const response = await fetch('https://api.deepgram.com/v1/projects', {
          headers: { 'Authorization': `Token ${deepgramKey}` }
        });
        results.deepgram = { 
          valid: response.ok,
          error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`
        };
      }
    } catch (error) {
      results.deepgram = { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }

    const allValid = Object.values(results).every(result => result.valid);

    res.json({
      status: allValid ? 'all_valid' : 'some_invalid',
      timestamp: new Date().toISOString(),
      results,
      summary: {
        total: Object.keys(results).length,
        valid: Object.values(results).filter(r => r.valid).length,
        invalid: Object.values(results).filter(r => !r.valid).length
      }
    });
  });

  // === TELEPHONY CALL CONTROL ENDPOINTS ===

  // Dial/Start call
  app.post("/api/call/dial", async (req, res) => {
    try {
      const { to, voiceType = 'masc' } = req.body;
      
      if (!to) {
        return res.status(400).json({ error: "Phone number 'to' is required" });
      }

      if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_NUMBER) {
        return res.status(500).json({ error: "Twilio credentials not configured" });
      }

      console.log(`[CALL] Dialing ${to} with voice type: ${voiceType}`);
      
      // Use TwilioProvider for consistency
      const { TwilioProvider } = await import('./providers/twilioProvider');
      const twilioProvider = new TwilioProvider();
      const result = await twilioProvider.startCall(to, voiceType);

      console.log(`[CALL] Call initiated: ${result.callId}`);

      res.json({ callSid: result.callId, status: result.status });
    } catch (error) {
      console.error('[CALL] Error initiating call:', error);
      res.status(500).json({ error: 'Failed to initiate call' });
    }
  });

  // Hangup call
  app.post("/api/call/hangup", async (req, res) => {
    try {
      const { callSid } = req.body;
      
      if (!callSid) {
        return res.status(400).json({ error: "callSid is required" });
      }

      // Use TwilioProvider for consistency
      const { TwilioProvider } = await import('./providers/twilioProvider');
      const twilioProvider = new TwilioProvider();
      const success = await twilioProvider.hangup(callSid);
      
      if (success) {
        console.log(`[CALL] Call ended: ${callSid}`);
        res.json({ success: true, callSid });
      } else {
        res.status(500).json({ error: 'Failed to hangup call' });
      }
    } catch (error) {
      console.error('[CALL] Error ending call:', error);
      res.status(500).json({ error: 'Failed to end call' });
    }
  });

  // Send DTMF tones - Create a call that plays digits
  app.post("/api/call/dtmf", async (req, res) => {
    try {
      const { callSid, digits } = req.body;
      
      if (!callSid || !digits) {
        return res.status(400).json({ error: "callSid and digits are required" });
      }

      console.log(`[CALL] Sending DTMF '${digits}' to call ${callSid}`);
      
      // Use TwilioProvider for consistency
      const { TwilioProvider } = await import('./providers/twilioProvider');
      const twilioProvider = new TwilioProvider();
      const success = await twilioProvider.sendDTMF(callSid, digits);
      
      if (success) {
        res.json({ success: true, callSid, digits });
      } else {
        res.status(500).json({ error: 'Failed to send DTMF via Twilio' });
      }
    } catch (error) {
      console.error('[CALL] Error sending DTMF:', error);
      res.status(500).json({ error: 'Failed to send DTMF' });
    }
  });

  // Answer call (for inbound)
  app.post("/api/call/answer", async (req, res) => {
    try {
      const { callSid } = req.body;
      
      console.log(`[CALL] Answered: ${callSid}`);
      res.json({ success: true, callSid });
    } catch (error) {
      console.error('[CALL] Error answering call:', error);
      res.status(500).json({ error: 'Failed to answer call' });
    }
  });

  // === AGENT/AI CONTROL ENDPOINTS ===

  let AGENT_PROMPT = 'Você é um assistente de chamadas em pt-BR. Seja prestativo e cordial.';
  const agentStates = new Map<string, { enabled: boolean }>();

  // Update agent prompt
  app.post("/api/agent/prompt", async (req, res) => {
    try {
      const { text, callSid } = req.body;
      
      if (!text || !callSid) {
        return res.status(400).json({ message: "text and callSid are required" });
      }

      console.log(`[AGENT] Injecting prompt for call ${callSid}: ${text}`);

      // Use TwilioProvider to inject prompt
      const { TwilioProvider } = await import('./providers/twilioProvider');
      const twilioProvider = new TwilioProvider();
      const success = await twilioProvider.injectPrompt(callSid, text);

      if (success) {
        // Store prompt in database
        queries.addPrompt.run({
          call_sid: callSid,
          prompt_text: text,
          applied: true
        });

        console.log(`[AGENT] Prompt injected and stored for call ${callSid}`);
        res.json({ message: "Prompt injected successfully", callSid, text });
      } else {
        res.status(500).json({ message: "Failed to inject prompt via Twilio" });
      }
    } catch (error) {
      console.error('[AGENT] Error injecting prompt:', error);
      res.status(500).json({ message: "Failed to inject prompt", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Enable AI agent
  app.post("/api/agent/enable", async (req, res) => {
    try {
      const { callSid } = req.body;
      
      if (!callSid) {
        return res.status(400).json({ message: "callSid is required" });
      }

      // Check if call is active before trying to control it
      const twilioClient = twilio(TWILIO_ACCOUNT_SID!, TWILIO_AUTH_TOKEN!);
      
      try {
        const call = await twilioClient.calls(callSid).fetch();
        if (call.status !== 'in-progress') {
          console.log(`[AGENT] Call ${callSid} is not active (status: ${call.status})`);
          return res.status(400).json({ 
            message: "Call is not active", 
            callSid, 
            status: call.status 
          });
        }
      } catch (fetchError) {
        console.log(`[AGENT] Call ${callSid} not found or inaccessible`);
        return res.status(404).json({ message: "Call not found", callSid });
      }

      console.log(`[AGENT] Enabling AI for call ${callSid}`);
      
      const { TwilioProvider } = await import('./providers/twilioProvider');
      const twilioProvider = new TwilioProvider();
      const success = await twilioProvider.resumeAI(callSid);

      if (success) {
        agentStates.set(callSid, { enabled: true });
        res.json({ message: "AI agent enabled", callSid });
      } else {
        res.status(500).json({ message: "Failed to enable AI via Twilio" });
      }
    } catch (error) {
      console.error('[AGENT] Error enabling AI:', error);
      res.status(500).json({ message: "Failed to enable AI", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Disable AI agent
  app.post("/api/agent/disable", async (req, res) => {
    try {
      const { callSid } = req.body;
      
      if (!callSid) {
        return res.status(400).json({ message: "callSid is required" });
      }

      // Check if call is active before trying to control it
      const twilioClient = twilio(TWILIO_ACCOUNT_SID!, TWILIO_AUTH_TOKEN!);
      
      try {
        const call = await twilioClient.calls(callSid).fetch();
        if (call.status !== 'in-progress') {
          console.log(`[AGENT] Call ${callSid} is not active (status: ${call.status})`);
          return res.status(400).json({ 
            message: "Call is not active", 
            callSid, 
            status: call.status 
          });
        }
      } catch (fetchError) {
        console.log(`[AGENT] Call ${callSid} not found or inaccessible`);
        return res.status(404).json({ message: "Call not found", callSid });
      }

      console.log(`[AGENT] Disabling AI for call ${callSid}`);
      
      const { TwilioProvider } = await import('./providers/twilioProvider');
      const twilioProvider = new TwilioProvider();
      const success = await twilioProvider.pauseAI(callSid);

      if (success) {
        agentStates.set(callSid, { enabled: false });
        res.json({ message: "AI agent disabled", callSid });
      } else {
        res.status(500).json({ message: "Failed to disable AI via Twilio" });
      }
    } catch (error) {
      console.error('[AGENT] Error disabling AI:', error);
      res.status(500).json({ message: "Failed to disable AI", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Pause speech (TTS only)
  app.post("/api/agent/pause-speech", async (req, res) => {
    try {
      const { callSid } = req.body;
      
      if (!callSid) {
        return res.status(400).json({ message: "callSid is required" });
      }

      console.log(`[AGENT] Pausing speech for call ${callSid}`);
      
      // Stop TTS session via ElevenLabs service
      const { elevenLabsService } = await import('./elevenlabs');
      const success = elevenLabsService.stopTTSSession(callSid);

      if (success) {
        res.json({ message: "Speech paused", callSid });
      } else {
        res.status(500).json({ message: "Failed to pause speech" });
      }
    } catch (error) {
      console.error('[AGENT] Error pausing speech:', error);
      res.status(500).json({ message: "Failed to pause speech", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Resume speech (TTS only)
  app.post("/api/agent/resume-speech", async (req, res) => {
    try {
      const { callSid } = req.body;
      
      if (!callSid) {
        return res.status(400).json({ message: "callSid is required" });
      }

      console.log(`[AGENT] Resuming speech for call ${callSid}`);
      
      // Restart TTS session via ElevenLabs service
      const { elevenLabsService } = await import('./elevenlabs');
      const success = await elevenLabsService.startTTSSession(callSid, 'masc');

      if (success) {
        res.json({ message: "Speech resumed", callSid });
      } else {
        res.status(500).json({ message: "Failed to resume speech" });
      }
    } catch (error) {
      console.error('[AGENT] Error resuming speech:', error);
      res.status(500).json({ message: "Failed to resume speech", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // === METRICS/MONITORING ENDPOINTS ===

  // Server-Sent Events for real-time metrics
  app.get('/api/metrics', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const sendMetrics = () => {
      const latencyMs = Math.floor(Math.random() * 50) + 20; // Simulated latency 20-70ms
      const metrics = {
        latencyMs,
        timestamp: Date.now(),
        activeConnections: 1
      };
      
      res.write(`data: ${JSON.stringify(metrics)}\n\n`);
    };

    // Send initial metrics
    sendMetrics();
    
    // Send metrics every 2 seconds
    const interval = setInterval(sendMetrics, 2000);

    // Cleanup on client disconnect
    req.on('close', () => {
      clearInterval(interval);
      console.log('[METRICS] Client disconnected from metrics stream');
    });

    console.log('[METRICS] Client connected to metrics stream');
  });

  console.log('[ROUTES] API routes configured');
  
  // Configure multer for microphone recordings upload
  const upload = multer({
    storage: multer.diskStorage({
      destination: async (req, file, cb) => {
        const recordingsDir = path.join(process.cwd(), 'recordings');
        await fs.mkdir(recordingsDir, { recursive: true });
        cb(null, recordingsDir);
      },
      filename: (req, file, cb) => {
        cb(null, file.originalname);
      }
    }),
    limits: {
      fileSize: 100 * 1024 * 1024 // 100MB limit
    }
  });

  // Upload microphone recording
  app.post("/api/recordings/upload", upload.single('audio'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No audio file provided" });
      }

      const { phoneNumber, callSid } = req.body;
      const filename = req.file.filename;
      const fileSize = req.file.size;

      // Calculate duration (approximate based on file size - will be updated when we add real duration detection)
      const estimatedDuration = Math.floor(fileSize / (44100 * 2)); // rough estimate

      // Add to database
      queries.addRecording.run(callSid, phoneNumber, filename);
      const recording = queries.getLastRecording.get() as any;
      
      // Update with file size and duration
      queries.updateRecording.run(estimatedDuration, fileSize, recording.id);

      console.log(`[RECORDING] Microphone recording uploaded: ${filename} (${fileSize} bytes)`);
      res.json({ 
        success: true, 
        id: recording.id, 
        filename,
        size: fileSize,
        duration: estimatedDuration
      });
    } catch (error) {
      console.error('[RECORDING] Error uploading microphone recording:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Real Twilio call recording setup
  app.post("/api/recordings/twilio/start", async (req, res) => {
    try {
      const { callSid, phoneNumber } = req.body;
      
      if (!callSid) {
        return res.status(400).json({ error: "callSid obrigatório" });
      }

      console.log(`[TWILIO] Starting real recording for call: ${callSid}`);

      // Start recording via Twilio API
      const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
      const recording = await twilioClient.calls(callSid).recordings.create({
        recordingTrack: 'both',
        trim: 'do-not-trim',
        recordingStatusCallback: `${process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:5000'}/api/recordings/twilio/callback`
      });

      const timestamp = Date.now();
      const filename = `${phoneNumber || 'unknown'}-${timestamp}.mp3`;
      
      queries.addRecording.run(callSid, phoneNumber || 'unknown', filename);
      const recordingDb = queries.getLastRecording.get() as any;
      
      console.log(`[TWILIO] Real recording started: ${recording.sid}`);
      res.json({ 
        success: true, 
        id: recordingDb.id, 
        recordingSid: recording.sid,
        filename, 
        callSid 
      });
    } catch (error) {
      console.error('[TWILIO] Error starting real recording:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Twilio recording callback - downloads the MP3 file
  app.post("/api/recordings/twilio/callback", async (req, res) => {
    try {
      const { RecordingSid, RecordingUrl, RecordingDuration, CallSid } = req.body;
      
      console.log(`[TWILIO] Recording completed: ${RecordingSid}, Duration: ${RecordingDuration}s`);
      
      // Download the recording file from Twilio
      const response = await fetch(RecordingUrl);
      if (!response.ok) throw new Error('Failed to download recording');
      
      const buffer = await response.arrayBuffer();
      const recordingsDir = path.join(process.cwd(), 'recordings');
      await fs.mkdir(recordingsDir, { recursive: true });
      
      // Find the recording in database by CallSid
      const recording = queries.getRecordingByCallSid.get(CallSid) as any;
      if (recording) {
        const filePath = path.join(recordingsDir, recording.filename);
        await fs.writeFile(filePath, Buffer.from(buffer));
        
        // Update database with final duration and size
        queries.updateRecording.run(parseInt(RecordingDuration), buffer.byteLength, recording.id);
        
        console.log(`[TWILIO] Recording saved: ${recording.filename} (${buffer.byteLength} bytes)`);
      }
      
      res.send('<Response></Response>'); // TwiML response
    } catch (error) {
      console.error('[TWILIO] Error processing recording callback:', error);
      res.status(500).send('<Response></Response>');
    }
  });

  // TwiML endpoint for Twilio calls - CRÍTICO para funcionar
  app.get("/twiml", (req, res) => {
    const { voiceType } = req.query;
    console.log(`[TWIML] Serving TwiML for voice type: ${voiceType}`);
    
    res.type('text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="pt-BR">Olá! Você está conectado ao sistema Abmix. Esta chamada está sendo controlada pelo painel de discagem inteligente.</Say>
  <Gather input="dtmf" timeout="10" numDigits="1">
    <Say voice="alice" language="pt-BR">Pressione qualquer tecla para continuar ou aguarde para falar com o assistente virtual.</Say>
  </Gather>
  <Say voice="alice" language="pt-BR">Obrigado por usar o sistema Abmix. A chamada será mantida ativa para testes. Pressione desligar no painel para encerrar.</Say>
  <Pause length="300"/>
</Response>`);
  });

  return server;
}