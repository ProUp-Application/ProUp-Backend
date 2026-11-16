import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { logger } from './logger';

/**
 * Transcripción de voz a texto con Whisper (Groq, plan gratuito).
 * El audio se procesa en memoria y NO se guarda en el servidor ni en la base de datos:
 * solo se devuelve el texto para que el usuario lo revise antes de enviarlo.
 *
 * Alcance: la transcripción permite evaluar el CONTENIDO de la respuesta; no mide
 * pronunciación, entonación, fluidez ni volumen.
 */
const WHISPER_MODELS = ['whisper-large-v3-turbo', 'whisper-large-v3'];

export interface Transcription {
  text: string;
  durationSeconds: number | null;
}

export function isSpeechEnabled(): boolean {
  return !!env.GROQ_API_KEY;
}

export async function transcribeAudio(audio: {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}): Promise<Transcription> {
  if (!isSpeechEnabled()) {
    throw new AppError(
      503,
      'SPEECH_UNAVAILABLE',
      'La transcripción de voz no está disponible en este momento. Puedes responder por escrito.',
    );
  }

  for (const model of WHISPER_MODELS) {
    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(audio.buffer)], { type: audio.mimetype || 'audio/mp4' }),
      audio.originalname || 'respuesta.m4a',
    );
    form.append('model', model);
    form.append('language', 'es');
    form.append('response_format', 'verbose_json');
    form.append('temperature', '0');

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
      body: form,
    });
    if (res.status === 404 || res.status === 429) {
      logger.warn({ model, status: res.status }, 'Whisper no disponible en este modelo, probando el siguiente');
      continue;
    }
    if (res.status === 400) {
      throw AppError.badRequest(
        'No pudimos procesar el audio. Graba de nuevo, más cerca del micrófono.',
        'AUDIO_INVALID',
      );
    }
    if (!res.ok) {
      logger.warn({ model, status: res.status }, 'Error de transcripción');
      break;
    }
    const data = (await res.json()) as { text?: string; duration?: number };
    const text = (data.text ?? '').trim();
    if (!text) {
      throw AppError.badRequest(
        'No se escuchó ninguna respuesta en la grabación. Revisa el micrófono y vuelve a grabar.',
        'EMPTY_TRANSCRIPTION',
      );
    }
    return {
      text,
      durationSeconds: typeof data.duration === 'number' ? Math.round(data.duration) : null,
    };
  }

  throw new AppError(
    503,
    'SPEECH_FAILED',
    'No pudimos transcribir tu respuesta ahora. Vuelve a intentarlo o responde por escrito.',
  );
}
