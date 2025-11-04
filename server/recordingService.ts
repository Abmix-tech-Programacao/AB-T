import { existsSync, mkdirSync, writeFileSync, readFileSync, statSync, createWriteStream, createReadStream } from 'fs';
import { join } from 'path';
import { db } from './db';
import { recordings, calls } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

export class RecordingService {
  private recordingsDir: string;
  private activeRecordings = new Map<string, NodeJS.Timeout>();

  constructor() {
    this.recordingsDir = join(process.cwd(), 'recordings');
    this.ensureRecordingsDirectory();
  }

  private ensureRecordingsDirectory(): void {
    if (!existsSync(this.recordingsDir)) {
      mkdirSync(this.recordingsDir, { recursive: true });
    }
  }

  async startRecording(callId: string, callSid?: string, phoneNumber?: string): Promise<any> {
    try {
      const timestamp = Date.now();
      const filename = `call-${phoneNumber || 'unknown'}-${timestamp}.wav`;
      const filePath = join(this.recordingsDir, filename);

      // Create recording record in database
      const [recording] = await db
        .insert(recordings)
        .values({
          callId,
          twilioRecordingSid: callSid,
          filename,
          status: 'recording',
          metadata: { phoneNumber, startedAt: new Date().toISOString() }
        })
        .returning();

      // Update call record with recording status
      await db
        .update(calls)
        .set({ recordingStatus: 'recording' })
        .where(eq(calls.id, callId));

      // Start simulated recording (in production, this would handle Twilio recording)
      this.startSimulatedRecording(recording.id, filePath);

      console.log(`[RECORDING] Started recording ${recording.id}: ${filename}`);
      
      return {
        id: recording.id,
        filename,
        status: 'recording',
        callId,
        startTime: recording.startTime
      };
    } catch (error) {
      console.error('[RECORDING] Error starting recording:', error);
      throw error;
    }
  }

  async pauseRecording(recordingId: string): Promise<any> {
    try {
      // Clear any active recording timeout
      const timeout = this.activeRecordings.get(recordingId);
      if (timeout) {
        clearTimeout(timeout);
        this.activeRecordings.delete(recordingId);
      }

      // Update recording status in database
      const [recording] = await db
        .update(recordings)
        .set({ 
          status: 'paused',
          metadata: db.select({ metadata: recordings.metadata }).from(recordings).where(eq(recordings.id, recordingId)).then(res => ({
            ...res[0]?.metadata as any,
            pausedAt: new Date().toISOString()
          }))
        })
        .where(eq(recordings.id, recordingId))
        .returning();

      if (!recording) {
        throw new Error('Recording not found');
      }

      console.log(`[RECORDING] Paused recording ${recordingId}`);
      
      return {
        id: recordingId,
        status: 'paused',
        message: 'Recording paused successfully'
      };
    } catch (error) {
      console.error('[RECORDING] Error pausing recording:', error);
      throw error;
    }
  }

  async resumeRecording(recordingId: string): Promise<any> {
    try {
      // Get recording details
      const [recording] = await db
        .select()
        .from(recordings)
        .where(eq(recordings.id, recordingId));

      if (!recording) {
        throw new Error('Recording not found');
      }

      // Update recording status
      const [updatedRecording] = await db
        .update(recordings)
        .set({ 
          status: 'recording',
          metadata: {
            ...recording.metadata as any,
            resumedAt: new Date().toISOString()
          }
        })
        .where(eq(recordings.id, recordingId))
        .returning();

      // Resume simulated recording
      const filePath = join(this.recordingsDir, recording.filename);
      this.startSimulatedRecording(recordingId, filePath, true);

      console.log(`[RECORDING] Resumed recording ${recordingId}`);
      
      return {
        id: recordingId,
        status: 'recording',
        message: 'Recording resumed successfully'
      };
    } catch (error) {
      console.error('[RECORDING] Error resuming recording:', error);
      throw error;
    }
  }

  async stopRecording(recordingId: string): Promise<any> {
    try {
      // Clear any active recording timeout
      const timeout = this.activeRecordings.get(recordingId);
      if (timeout) {
        clearTimeout(timeout);
        this.activeRecordings.delete(recordingId);
      }

      // Get recording details
      const [recording] = await db
        .select()
        .from(recordings)
        .where(eq(recordings.id, recordingId));

      if (!recording) {
        throw new Error('Recording not found');
      }

      const filePath = join(this.recordingsDir, recording.filename);
      
      // Generate audio file if it doesn't exist
      if (!existsSync(filePath)) {
        this.generateDemoAudioFile(filePath);
      }

      // Calculate file size and duration
      const stats = statSync(filePath);
      const duration = this.calculateAudioDuration(filePath);

      // Update recording with completion details
      const [updatedRecording] = await db
        .update(recordings)
        .set({
          status: 'completed',
          endTime: new Date(),
          duration,
          fileSize: stats.size,
          metadata: {
            ...recording.metadata as any,
            completedAt: new Date().toISOString(),
            filePath
          }
        })
        .where(eq(recordings.id, recordingId))
        .returning();

      // Update call record
      if (recording.callId) {
        await db
          .update(calls)
          .set({ 
            recordingStatus: 'completed',
            recordingUrl: `/api/recordings/${recordingId}/download`
          })
          .where(eq(calls.id, recording.callId));
      }

      console.log(`[RECORDING] Completed recording ${recordingId}: ${recording.filename}`);
      
      return {
        id: recordingId,
        filename: recording.filename,
        status: 'completed',
        duration,
        fileSize: stats.size,
        downloadUrl: `/api/recordings/${recordingId}/download`
      };
    } catch (error) {
      console.error('[RECORDING] Error stopping recording:', error);
      throw error;
    }
  }

  async getRecording(recordingId: string): Promise<any> {
    try {
      const [recording] = await db
        .select({
          id: recordings.id,
          filename: recordings.filename,
          status: recordings.status,
          startTime: recordings.startTime,
          endTime: recordings.endTime,
          duration: recordings.duration,
          fileSize: recordings.fileSize,
          transcription: recordings.transcription,
          metadata: recordings.metadata,
          callId: recordings.callId,
          toNumber: calls.toNumber,
          fromNumber: calls.fromNumber
        })
        .from(recordings)
        .leftJoin(calls, eq(recordings.callId, calls.id))
        .where(eq(recordings.id, recordingId));

      if (!recording) {
        throw new Error('Recording not found');
      }

      return recording;
    } catch (error) {
      console.error('[RECORDING] Error getting recording:', error);
      throw error;
    }
  }

  async getAllRecordings(): Promise<any[]> {
    try {
      const recordingsList = await db
        .select({
          id: recordings.id,
          filename: recordings.filename,
          status: recordings.status,
          startTime: recordings.startTime,
          endTime: recordings.endTime,
          duration: recordings.duration,
          fileSize: recordings.fileSize,
          transcription: recordings.transcription,
          callId: recordings.callId,
          toNumber: calls.toNumber,
          fromNumber: calls.fromNumber
        })
        .from(recordings)
        .leftJoin(calls, eq(recordings.callId, calls.id))
        .orderBy(desc(recordings.startTime));

      return recordingsList;
    } catch (error) {
      console.error('[RECORDING] Error getting recordings:', error);
      throw error;
    }
  }

  async getRecordingFile(recordingId: string): Promise<{ filePath: string; filename: string; mimeType: string }> {
    try {
      const [recording] = await db
        .select()
        .from(recordings)
        .where(eq(recordings.id, recordingId));

      if (!recording) {
        throw new Error('Recording not found');
      }

      const filePath = join(this.recordingsDir, recording.filename);
      
      if (!existsSync(filePath)) {
        // Generate demo file if it doesn't exist
        this.generateDemoAudioFile(filePath);
      }

      return {
        filePath,
        filename: recording.filename,
        mimeType: 'audio/wav'
      };
    } catch (error) {
      console.error('[RECORDING] Error getting recording file:', error);
      throw error;
    }
  }

  private startSimulatedRecording(recordingId: string, filePath: string, isResume = false): void {
    // Simulate recording process with periodic updates
    const updateInterval = setInterval(() => {
      // In production, this would handle real audio stream processing
      console.log(`[RECORDING] Recording ${recordingId} in progress...`);
    }, 5000);

    // Store the interval for cleanup
    this.activeRecordings.set(recordingId, updateInterval);

    // Auto-complete after 30 seconds for demo purposes
    setTimeout(() => {
      if (this.activeRecordings.has(recordingId)) {
        this.generateDemoAudioFile(filePath);
        clearInterval(updateInterval);
        this.activeRecordings.delete(recordingId);
      }
    }, 30000);
  }

  private generateDemoAudioFile(filePath: string): void {
    // Generate a simple WAV file with a tone for demo purposes
    const duration = 10; // 10 seconds
    const sampleRate = 44100;
    const channels = 1;
    const bitsPerSample = 16;
    const blockAlign = channels * bitsPerSample / 8;
    const byteRate = sampleRate * blockAlign;
    const dataSize = duration * byteRate;
    const fileSize = 36 + dataSize;

    const header = Buffer.alloc(44);
    
    // WAV header
    header.write('RIFF', 0);
    header.writeUInt32LE(fileSize, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    // Generate audio data (simple tone)
    const audioData = Buffer.alloc(dataSize);
    const frequency = 440; // A4 note
    
    for (let i = 0; i < dataSize / 2; i++) {
      const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.3 * 32767;
      audioData.writeInt16LE(Math.round(sample), i * 2);
    }

    writeFileSync(filePath, Buffer.concat([header, audioData]));
  }

  private calculateAudioDuration(filePath: string): number {
    try {
      const stats = statSync(filePath);
      // Simple duration calculation for WAV files (assuming 44.1kHz, 16-bit, mono)
      return Math.round((stats.size - 44) / (44100 * 2));
    } catch {
      return 0;
    }
  }
}

export const recordingService = new RecordingService();