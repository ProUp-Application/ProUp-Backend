import { Router } from 'express';
import { AuthController } from './controllers/AuthController.js';
import { loginSchema, registerSchema } from './dtos/auth.dto.js';
import { InMemoryUserRepository } from './repositories/InMemoryUserRepository.js';
import { AuthService } from './services/AuthService.js';
import { validateRequest } from '../../shared/middleware/validateRequest.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { asyncHandler } from '../../shared/middleware/asyncHandler.js';

const userRepository = new InMemoryUserRepository();
const authService = new AuthService(userRepository);
const authController = new AuthController(authService);

export const authRouter = Router();

authRouter.post('/register', validateRequest(registerSchema), asyncHandler(authController.register));
authRouter.post('/login', validateRequest(loginSchema), asyncHandler(authController.login));
authRouter.get('/profile', authenticate, asyncHandler(authController.profile));
