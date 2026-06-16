import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError } from '../../utils/AppError';
import * as usersService from './users.service';

const uid = (req: Request) => {
  if (!req.userId) throw AppError.unauthorized();
  return req.userId;
};

export const getProfileHandler = asyncHandler(async (req: Request, res: Response) => {
  const profile = await usersService.getProfile(uid(req));
  res.json({ profile });
});

export const updateProfileHandler = asyncHandler(async (req: Request, res: Response) => {
  const profile = await usersService.upsertProfile(uid(req), req.body);
  res.json({ profile });
});

export const exportDataHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = await usersService.exportData(uid(req));
  res.json(data);
});

export const deleteAccountHandler = asyncHandler(async (req: Request, res: Response) => {
  await usersService.deleteAccount(uid(req));
  res.status(204).send();
});

export const setConsentHandler = asyncHandler(async (req: Request, res: Response) => {
  const consent = await usersService.setConsent(uid(req), req.body);
  res.status(201).json({ consent });
});

export const listConsentsHandler = asyncHandler(async (req: Request, res: Response) => {
  const consents = await usersService.listConsents(uid(req));
  res.json({ consents });
});
