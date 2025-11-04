import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// Ensure data directory exists
const dataDir = join(process.cwd(), 'data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// Initialize SQLite database
const dbPath = join(dataDir, 'app.db');
export const db = Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Create tables
export function initDatabase() {
  console.log('[DB] Initializing database at:', dbPath);

  // Recordings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS recordings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      call_sid TEXT NOT NULL,
      phone_number TEXT,
      filename TEXT NOT NULL,
      duration_sec INTEGER DEFAULT 0,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      size_bytes INTEGER DEFAULT 0,
      UNIQUE(call_sid, started_at)
    )
  `);

  // Calls table
  db.exec(`
    CREATE TABLE IF NOT EXISTS calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      to_number TEXT NOT NULL,
      from_number TEXT,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      status TEXT DEFAULT 'initiated'
    )
  `);

  // Favorites table
  db.exec(`
    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone_e164 TEXT NOT NULL,
      voice_type TEXT DEFAULT 'masc' CHECK(voice_type IN ('masc', 'fem')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(phone_e164)
    )
  `);

  // Settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Prompts table for AI agent prompts
  db.exec(`
    CREATE TABLE IF NOT EXISTS prompts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      call_sid TEXT NOT NULL,
      prompt_text TEXT NOT NULL,
      applied BOOLEAN DEFAULT false,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // VoIP Numbers table for managing multiple phone numbers
  db.exec(`
    CREATE TABLE IF NOT EXISTS voip_numbers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      number TEXT NOT NULL UNIQUE,
      provider TEXT NOT NULL CHECK(provider IN ('twilio', 'sobreip', 'falevono')),
      sip_username TEXT,
      sip_password TEXT,
      sip_server TEXT,
      sip_port INTEGER DEFAULT 5060,
      sip_ips TEXT,
      is_default BOOLEAN DEFAULT false,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insert default settings if they don't exist
  const defaultSettings = [
    { key: 'VOZ_MASC_ID', value: 'pNInz6obpgDQGcFmaJgB' }, // Default ElevenLabs voice
    { key: 'VOZ_FEM_ID', value: 'EXAVITQu4vr4xnSDxMaL' }, // Default ElevenLabs voice
    { key: 'MODELO', value: 'eleven_multilingual_v2' }, // Modelo mais natural
    { key: 'VELOCIDADE', value: '1.0' },
    { key: 'ESTILO', value: 'neutro' },
    { key: 'STT_IDIOMA', value: 'pt-BR' },
    // Configurações avançadas para voz mais natural
    { key: 'VOICE_STABILITY', value: '0.35' },      // Mais emotivo
    { key: 'VOICE_SIMILARITY', value: '0.95' },     // Máxima similaridade
    { key: 'VOICE_STYLE', value: '0.15' },          // Estilo sutil
    { key: 'VOICE_SPEAKER_BOOST', value: 'true' },  // Clareza máxima
    { key: 'VOICE_PROCESSING', value: 'enhanced' }  // Processamento aprimorado
  ];

  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  
  for (const setting of defaultSettings) {
    insertSetting.run(setting.key, setting.value);
  }

  console.log('[DB] Database initialized successfully');
}

// Initialize on import
initDatabase();

// Helper functions for common queries
export const queries = {
  // Settings
  getSetting: db.prepare('SELECT value FROM settings WHERE key = ?'),
  setSetting: db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)'),
  getAllSettings: db.prepare('SELECT key, value FROM settings'),

  // Favorites
  getAllFavorites: db.prepare('SELECT * FROM favorites ORDER BY name ASC'),
  addFavorite: db.prepare('INSERT INTO favorites (name, phone_e164, voice_type) VALUES (?, ?, ?)'),
  removeFavorite: db.prepare('DELETE FROM favorites WHERE id = ?'),
  
  // Recordings
  getAllRecordings: db.prepare('SELECT * FROM recordings ORDER BY started_at DESC'),
  addRecording: db.prepare('INSERT INTO recordings (call_sid, phone_number, filename) VALUES (?, ?, ?)'),
  getLastRecording: db.prepare('SELECT * FROM recordings ORDER BY id DESC LIMIT 1'),
  updateRecording: db.prepare('UPDATE recordings SET ended_at = CURRENT_TIMESTAMP, duration_sec = ?, size_bytes = ? WHERE id = ?'),
  getRecordingById: db.prepare('SELECT * FROM recordings WHERE id = ?'),
  getRecordingByCallSid: db.prepare('SELECT * FROM recordings WHERE call_sid = ?'),
  deleteRecording: db.prepare('DELETE FROM recordings WHERE id = ?'),
  
  // Calls
  addCall: db.prepare('INSERT INTO calls (to_number, from_number, status) VALUES (?, ?, ?)'),
  updateCallStatus: db.prepare('UPDATE calls SET status = ?, ended_at = CURRENT_TIMESTAMP WHERE id = ?'),
  
  // Prompts
  addPrompt: db.prepare('INSERT INTO prompts (call_sid, prompt_text, applied) VALUES (?, ?, ?)'),
  getPromptsByCallSid: db.prepare('SELECT * FROM prompts WHERE call_sid = ? ORDER BY created_at DESC'),
  
  // VoIP Numbers
  getAllVoipNumbers: db.prepare('SELECT * FROM voip_numbers ORDER BY is_default DESC, name ASC'),
  getVoipNumberById: db.prepare('SELECT * FROM voip_numbers WHERE id = ?'),
  getVoipNumberByNumber: db.prepare('SELECT * FROM voip_numbers WHERE number = ?'),
  getDefaultVoipNumber: db.prepare('SELECT * FROM voip_numbers WHERE is_default = true LIMIT 1'),
  addVoipNumber: db.prepare('INSERT INTO voip_numbers (name, number, provider, sip_username, sip_password, sip_server, is_default, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
  updateVoipNumber: db.prepare('UPDATE voip_numbers SET name = ?, number = ?, provider = ?, sip_username = ?, sip_password = ?, sip_server = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
  setDefaultVoipNumber: db.prepare('UPDATE voip_numbers SET is_default = CASE WHEN id = ? THEN true ELSE false END'),
  deleteVoipNumber: db.prepare('DELETE FROM voip_numbers WHERE id = ?')
};