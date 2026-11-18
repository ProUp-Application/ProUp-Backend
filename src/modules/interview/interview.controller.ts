import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError } from '../../utils/AppError';
import * as interviewService from './interview.service';
import { transcribeAudio } from '../../lib/speech';

const uid = (req: Request) => {
  if (!req.userId) throw AppError.unauthorized();
  return req.userId;
};

export const startHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await interviewService.startInterview(uid(req), req.body.track);
  res.status(201).json(result);
});

export const submitHandler = asyncHandler(async (req: Request, res: Response) => {
  const simulation = await interviewService.submitInterview(uid(req), req.params.id, req.body);
  res.json({ simulation });
});

export const listHandler = asyncHandler(async (req: Request, res: Response) => {
  const simulations = await interviewService.listInterviews(uid(req));
  res.json({ simulations });
});

export const getHandler = asyncHandler(async (req: Request, res: Response) => {
  const simulation = await interviewService.getInterview(uid(req), req.params.id);
  res.json({ simulation });
});

/**
 * Transcribe una respuesta grabada en voz. El audio se procesa en memoria y no se
 * guarda; la app muestra el texto para que el usuario lo revise y corrija.
 */
export const transcribeHandler = asyncHandler(async (req: Request, res: Response) => {
  uid(req);
  const file = req.file;
  if (!file) throw AppError.badRequest('Adjunta el audio en el campo "audio"', 'AUDIO_REQUIRED');
  const transcription = await transcribeAudio({
    buffer: file.buffer,
    originalname: file.originalname,
    mimetype: file.mimetype,
  });
  res.json({ transcription });
});
