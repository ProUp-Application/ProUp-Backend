import { type Request, type Response } from 'express';
import { type LoginDto, type RegisterDto } from '../dtos/auth.dto.js';
import { type AuthService } from '../services/AuthService.js';

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  register = async (request: Request<unknown, unknown, RegisterDto>, response: Response): Promise<void> => {
    const result = await this.authService.register(request.body);
    response.status(201).json(result);
  };

  login = async (request: Request<unknown, unknown, LoginDto>, response: Response): Promise<void> => {
    const result = await this.authService.login(request.body);
    response.status(200).json(result);
  };

  profile = async (request: Request, response: Response): Promise<void> => {
    const userId = request.user?.sub;
    const profile = await this.authService.getProfile(userId ?? '');
    response.status(200).json(profile);
  };
}
