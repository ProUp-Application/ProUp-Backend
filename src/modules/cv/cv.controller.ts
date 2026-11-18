import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError } from '../../utils/AppError';
import { extractCvDocument } from '../chat/attachment.service';
import { buildCvDocx } from './cv.docx';
import * as cvService from './cv.service';

const uid = (req: Request) => {
  if (!req.userId) throw AppError.unauthorized();
  return req.userId;
};

/** Lee el archivo del CV y devuelve su texto para que el usuario lo revise. No se guarda. */
export const extractHandler = asyncHandler(async (req: Request, res: Response) => {
  uid(req);
  const file = req.file;
  if (!file) throw AppError.badRequest('Adjunta tu CV en el campo "file"', 'FILE_REQUIRED');
  const document = await extractCvDocument({
    buffer: file.buffer,
    originalname: file.originalname,
    mimetype: file.mimetype,
  });
  res.json({ document: { ...document, filename: file.originalname } });
});

export const analyzeHandler = asyncHandler(async (req: Request, res: Response) => {
  const analysis = await cvService.analyzeCv(uid(req), req.body);
  res.json({ analysis });
});

export const improveHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await cvService.improveCv(uid(req), req.body);
  res.json({ result });
});

/** Genera el .docx a partir del CV que el usuario revisó y editó. */
export const exportDocxHandler = asyncHandler(async (req: Request, res: Response) => {
  uid(req);
  const buffer = await buildCvDocx(req.body.cv);
  const safe = String(req.body.cv.fullName || 'CV')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="CV_${safe || 'ProUp'}.docx"`);
  res.send(buffer);
});

export const matchHandler = asyncHandler(async (req: Request, res: Response) => {
  const match = await cvService.matchVacancy(uid(req), req.body);
  res.json({ match });
});
