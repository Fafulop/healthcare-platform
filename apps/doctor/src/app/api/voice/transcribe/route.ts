/**
 * POST /api/voice/transcribe
 *
 * Converts audio to text using OpenAI Whisper API.
 *
 * Request: multipart/form-data with audio file
 * Response: { success: true, data: { transcript, transcriptId, duration, language } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';
import { logTokenUsage } from '@/lib/ai/log-token-usage';
import OpenAI, { toFile } from 'openai';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Lazy-initialize OpenAI client to avoid build-time crash
let _openai: OpenAI;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

// Configuration
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB (OpenAI limit)
const MAX_DURATION_SECONDS = 600; // 10 minutes
const MIN_DURATION_SECONDS = 1; // 1 second minimum

// Map MIME types to file extensions for OpenAI
function getFileExtension(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/webm;codecs=opus': 'webm',
    'audio/mp4': 'm4a',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/ogg;codecs=opus': 'ogg',
    'audio/wav': 'wav',
    'audio/flac': 'flac',
  };
  return mimeToExt[mimeType] || 'webm';
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication check
    const { doctorId } = await requireDoctorAuth(request);

    // 2. Parse multipart form data
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;
    const language = (formData.get('language') as string) || 'es';

    // 3. Validate audio file exists
    if (!audioFile) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_AUDIO',
            message: 'No se recibió archivo de audio',
          },
        },
        { status: 400 }
      );
    }

    // 4. Validate file size
    if (audioFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'AUDIO_TOO_LARGE',
            message: `El archivo de audio excede el límite de ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
          },
        },
        { status: 400 }
      );
    }

    // 5. Generate transcript ID for audit trail
    const transcriptId = crypto.randomUUID();

    // 6. Convert audio to proper format for OpenAI
    const arrayBuffer = await audioFile.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Debug: Check file header to determine actual format
    const header = Array.from(uint8Array.slice(0, 12)).map(b => b.toString(16).padStart(2, '0')).join(' ');
    console.log(`[Voice Transcribe] File header: ${header}`);
    console.log(`[Voice Transcribe] File name: ${audioFile.name}, type: "${audioFile.type}", size: ${audioFile.size} bytes`);

    // Determine the actual file extension based on content
    // webm starts with: 1a 45 df a3
    // ogg starts with: 4f 67 67 53 (OggS)
    // mp3 starts with: 49 44 33 (ID3) or ff fb/ff fa
    let filename = 'recording.webm';
    if (uint8Array[0] === 0x4f && uint8Array[1] === 0x67 && uint8Array[2] === 0x67) {
      filename = 'recording.ogg';
    } else if (uint8Array[0] === 0x49 && uint8Array[1] === 0x44 && uint8Array[2] === 0x33) {
      filename = 'recording.mp3';
    } else if (uint8Array[0] === 0xff && (uint8Array[1] === 0xfb || uint8Array[1] === 0xfa)) {
      filename = 'recording.mp3';
    }

    console.log(`[Voice Transcribe] Using filename: ${filename}`);

    // Use toFile with detected filename
    const audioFileForOpenAI = await toFile(Buffer.from(arrayBuffer), filename);

    // 7. Call OpenAI Whisper API
    const transcription = await getOpenAI().audio.transcriptions.create({
      file: audioFileForOpenAI,
      model: 'whisper-1',
      language: language,
      response_format: 'verbose_json',
    });

    // 8. Validate transcription result
    if (!transcription.text || transcription.text.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'TRANSCRIPTION_FAILED',
            message: 'No se pudo transcribir el audio. Asegúrese de hablar claramente.',
          },
        },
        { status: 400 }
      );
    }

    // 9. Check duration (from Whisper response)
    const duration = transcription.duration || 0;

    if (duration < MIN_DURATION_SECONDS) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'AUDIO_TOO_SHORT',
            message: 'La grabación es muy corta. Intente nuevamente.',
          },
        },
        { status: 400 }
      );
    }

    if (duration > MAX_DURATION_SECONDS) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'AUDIO_TOO_LONG',
            message: `La grabación excede el límite de ${MAX_DURATION_SECONDS / 60} minutos.`,
          },
        },
        { status: 400 }
      );
    }

    // 10. Log for audit
    console.log(`[Voice Transcribe] Doctor: ${doctorId}, TranscriptID: ${transcriptId}, Duration: ${duration}s`);
    logTokenUsage({
      doctorId,
      endpoint: 'voice-transcribe',
      model: 'whisper-1',
      provider: 'openai',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      durationSeconds: duration,
    });

    // 11. Return success response
    return NextResponse.json({
      success: true,
      data: {
        transcript: transcription.text,
        transcriptId,
        duration,
        language: transcription.language || language,
      },
    });
  } catch (error: any) {
    console.error('[Voice Transcribe Error]', error);

    // Handle OpenAI-specific errors
    if (error?.status === 429) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Demasiadas solicitudes. Intente de nuevo en unos momentos.',
          },
        },
        { status: 429 }
      );
    }

    if (error?.code === 'ECONNREFUSED' || error?.code === 'ETIMEDOUT') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NETWORK_ERROR',
            message: 'Error de conexión. Verifique su internet e intente nuevamente.',
          },
        },
        { status: 503 }
      );
    }

    // Use standard error handler for auth and other errors
    return handleApiError(error, 'POST /api/voice/transcribe');
  }
}
