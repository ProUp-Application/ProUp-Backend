import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError } from '../../utils/AppError';
import * as chatService from './chat.service';

const uid = (req: Request) => {
  if (!req.userId) throw AppError.unauthorized();
  return req.userId;
};

export const createSessionHandler = asyncHandler(async (req: Request, res: Response) => {
  const session = await chatService.createSession(uid(req), req.body.title);
  res.status(201).json({ session });
});

export const listSessionsHandler = asyncHandler(async (req: Request, res: Response) => {
  const sessions = await chatService.listSessions(uid(req));
  res.json({ sessions });
});

export const getMessagesHandler = asyncHandler(async (req: Request, res: Response) => {
  const messages = await chatService.getMessages(uid(req), req.params.id);
  res.json({ messages });
});

export const sendMessageHandler = asyncHandler(async (req: Request, res: Response) => {
  const message = await chatService.sendMessage(uid(req), req.params.id, req.body.content);
  res.status(201).json({ message });
});
