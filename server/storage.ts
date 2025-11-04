import { type Favorite, type InsertFavorite, type Call, type InsertCall, type Transcript, type InsertTranscript, type Prompt, type InsertPrompt } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Favorites
  getFavorites(): Promise<Favorite[]>;
  getFavorite(id: string): Promise<Favorite | undefined>;
  createFavorite(favorite: InsertFavorite): Promise<Favorite>;
  updateFavorite(id: string, favorite: Partial<InsertFavorite>): Promise<Favorite | undefined>;
  deleteFavorite(id: string): Promise<boolean>;

  // Calls
  getCalls(): Promise<Call[]>;
  getCall(id: string): Promise<Call | undefined>;
  createCall(call: InsertCall): Promise<Call>;
  updateCall(id: string, call: Partial<Call>): Promise<Call | undefined>;

  // Transcripts
  getTranscripts(callId: string): Promise<Transcript[]>;
  createTranscript(transcript: InsertTranscript): Promise<Transcript>;

  // Prompts
  getPrompts(callId: string): Promise<Prompt[]>;
  createPrompt(prompt: InsertPrompt): Promise<Prompt>;
  updatePrompt(id: string, prompt: Partial<Prompt>): Promise<Prompt | undefined>;
}

export class MemStorage implements IStorage {
  private favorites: Map<string, Favorite>;
  private calls: Map<string, Call>;
  private transcripts: Map<string, Transcript>;
  private prompts: Map<string, Prompt>;

  constructor() {
    this.favorites = new Map();
    this.calls = new Map();
    this.transcripts = new Map();
    this.prompts = new Map();
  }

  // Favorites
  async getFavorites(): Promise<Favorite[]> {
    return Array.from(this.favorites.values());
  }

  async getFavorite(id: string): Promise<Favorite | undefined> {
    return this.favorites.get(id);
  }

  async createFavorite(insertFavorite: InsertFavorite): Promise<Favorite> {
    const id = randomUUID();
    const favorite: Favorite = {
      id,
      name: insertFavorite.name,
      phoneE164: insertFavorite.phoneE164,
      voiceType: insertFavorite.voiceType || 'masc',
      createdAt: new Date(),
    };
    this.favorites.set(id, favorite);
    return favorite;
  }

  async updateFavorite(id: string, updateData: Partial<InsertFavorite>): Promise<Favorite | undefined> {
    const existing = this.favorites.get(id);
    if (!existing) return undefined;

    const updated: Favorite = { ...existing, ...updateData };
    this.favorites.set(id, updated);
    return updated;
  }

  async deleteFavorite(id: string): Promise<boolean> {
    return this.favorites.delete(id);
  }

  // Calls
  async getCalls(): Promise<Call[]> {
    return Array.from(this.calls.values());
  }

  async getCall(id: string): Promise<Call | undefined> {
    return this.calls.get(id);
  }

  async createCall(insertCall: InsertCall): Promise<Call> {
    const id = randomUUID();
    const call: Call = {
      ...insertCall,
      id,
      startTime: new Date(),
      endTime: null,
      duration: null,
      recordingUrl: null,
      recordingStatus: null,
      metadata: null,
      fromNumber: insertCall.fromNumber || null,
      twilioSid: insertCall.twilioSid || null,
    };
    this.calls.set(id, call);
    return call;
  }

  async updateCall(id: string, updateData: Partial<Call>): Promise<Call | undefined> {
    const existing = this.calls.get(id);
    if (!existing) return undefined;

    const updated: Call = { ...existing, ...updateData };
    this.calls.set(id, updated);
    return updated;
  }

  // Transcripts
  async getTranscripts(callId: string): Promise<Transcript[]> {
    return Array.from(this.transcripts.values()).filter(t => t.callId === callId);
  }

  async createTranscript(insertTranscript: InsertTranscript): Promise<Transcript> {
    const id = randomUUID();
    const transcript: Transcript = {
      ...insertTranscript,
      id,
      timestamp: new Date(),
      callId: insertTranscript.callId || null,
      isFinal: insertTranscript.isFinal || null,
      confidence: insertTranscript.confidence || null,
    };
    this.transcripts.set(id, transcript);
    return transcript;
  }

  // Prompts
  async getPrompts(callId: string): Promise<Prompt[]> {
    return Array.from(this.prompts.values()).filter(p => p.callId === callId);
  }

  async createPrompt(insertPrompt: InsertPrompt): Promise<Prompt> {
    const id = randomUUID();
    const prompt: Prompt = {
      ...insertPrompt,
      id,
      timestamp: new Date(),
      applied: false,
      callId: insertPrompt.callId || null,
    };
    this.prompts.set(id, prompt);
    return prompt;
  }

  async updatePrompt(id: string, updateData: Partial<Prompt>): Promise<Prompt | undefined> {
    const existing = this.prompts.get(id);
    if (!existing) return undefined;

    const updated: Prompt = { ...existing, ...updateData };
    this.prompts.set(id, updated);
    return updated;
  }
}

export const storage = new MemStorage();
