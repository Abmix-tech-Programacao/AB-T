import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const favorites = pgTable("favorites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  phoneE164: text("phone_e164").notNull().unique(),
  voiceType: text("voice_type").notNull().default('masc'),
  createdAt: timestamp("created_at").defaultNow(),
});

export const calls = pgTable("calls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  twilioSid: text("twilio_sid"),
  toNumber: text("to_number").notNull(),
  fromNumber: text("from_number"),
  provider: text("provider").notNull(),
  status: text("status").notNull(),
  startTime: timestamp("start_time").defaultNow(),
  endTime: timestamp("end_time"),
  duration: integer("duration"),
  recordingUrl: text("recording_url"),
  recordingStatus: text("recording_status"), // 'not_started', 'recording', 'paused', 'completed'
  metadata: jsonb("metadata"),
});

export const recordings = pgTable("recordings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  callId: varchar("call_id").references(() => calls.id),
  twilioRecordingSid: text("twilio_recording_sid"),
  filename: text("filename").notNull(),
  status: text("status").notNull(), // 'recording', 'paused', 'completed', 'failed'
  startTime: timestamp("start_time").defaultNow(),
  endTime: timestamp("end_time"),
  duration: integer("duration"), // in seconds
  fileSize: integer("file_size"), // in bytes
  transcription: text("transcription"),
  metadata: jsonb("metadata"),
});

export const transcripts = pgTable("transcripts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  callId: varchar("call_id").references(() => calls.id),
  speaker: text("speaker").notNull(), // 'AI' | 'Human' | 'Remote'
  text: text("text").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  isFinal: boolean("is_final").default(false),
  confidence: integer("confidence"),
});

export const prompts = pgTable("prompts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  callId: varchar("call_id").references(() => calls.id),
  prompt: text("prompt").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  applied: boolean("applied").default(false),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertFavoriteSchema = createInsertSchema(favorites).omit({
  id: true,
  createdAt: true,
});

export const insertCallSchema = createInsertSchema(calls).omit({
  id: true,
  startTime: true,
  endTime: true,
  duration: true,
});

export const insertRecordingSchema = createInsertSchema(recordings).omit({
  id: true,
  startTime: true,
  endTime: true,
  duration: true,
  fileSize: true,
});

export const insertTranscriptSchema = createInsertSchema(transcripts).omit({
  id: true,
  timestamp: true,
});

export const insertPromptSchema = createInsertSchema(prompts).omit({
  id: true,
  timestamp: true,
  applied: true,
});

export const insertSettingSchema = createInsertSchema(settings).omit({
  updatedAt: true,
});

export type InsertFavorite = z.infer<typeof insertFavoriteSchema>;
export type InsertCall = z.infer<typeof insertCallSchema>;
export type InsertRecording = z.infer<typeof insertRecordingSchema>;
export type InsertTranscript = z.infer<typeof insertTranscriptSchema>;
export type InsertPrompt = z.infer<typeof insertPromptSchema>;
export type InsertSetting = z.infer<typeof insertSettingSchema>;

export type Favorite = typeof favorites.$inferSelect;
export type Call = typeof calls.$inferSelect;
export type Recording = typeof recordings.$inferSelect;
export type Transcript = typeof transcripts.$inferSelect;
export type Prompt = typeof prompts.$inferSelect;
export type Setting = typeof settings.$inferSelect;

// Validation schemas
export const phoneNumberSchema = z.string().regex(/^\+[1-9]\d{1,14}$/, "Invalid E.164 format");
export const dtmfToneSchema = z.enum(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "#"]);
export const callStateSchema = z.enum(["IDLE", "RINGING", "CONNECTED", "ENDED"]);
export const speakerSchema = z.enum(["AI", "Human", "Remote"]);
export const providerSchema = z.enum(["vapi", "retell", "twilio", "mock"]);
