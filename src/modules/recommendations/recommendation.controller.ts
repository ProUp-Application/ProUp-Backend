import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError } from '../../utils/AppError';
import { addFeedback, markApplied } from './recommendation.service';

const uid = (req: Request) => {
  if (!req.userId) throw AppError.unauthorized();
  return req.userId;
};

export const feedbackHandler = asyncHandler(async (req: Request, res: Response) => {
  const fb = await addFeedback(uid(req), req.params.id, req.body.rating, req.body.comments);
  res.status(201).json({ feedback: fb });
});

export const appliedHandler = asyncHandler(async (req: Request, res: Response) => {
  const rec = await markApplied(uid(req), req.params.id, req.body.applied);
  res.json({ recommendation: rec });
});
