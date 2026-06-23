import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError } from '../../utils/AppError';
import * as analysisService from './analysis.service';

const uid = (req: Request) => {
  if (!req.userId) throw AppError.unauthorized();
  return req.userId;
};

export const createAnalysisHandler = asyncHandler(async (req: Request, res: Response) => {
  const analysis = await analysisService.createAnalysis(uid(req), req.body);
  res.status(201).json({ analysis });
});

export const listAnalysesHandler = asyncHandler(async (req: Request, res: Response) => {
  const analyses = await analysisService.listAnalyses(uid(req));
  res.json({ analyses });
});

export const getAnalysisHandler = asyncHandler(async (req: Request, res: Response) => {
  const analysis = await analysisService.getAnalysis(uid(req), req.params.id);
  res.json({ analysis });
});
