import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../../config/env.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { type LoginDto, type RegisterDto } from '../dtos/auth.dto.js';
import { type User } from '../domain/User.js';
import { type UserRepository } from '../repositories/UserRepository.js';

interface AuthResult {
  accessToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    createdAt: Date;
  };
}

export class AuthService {
  constructor(private readonly userRepository: UserRepository) {}

  async register(data: RegisterDto): Promise<AuthResult> {
    const existingUser = await this.userRepository.findByEmail(data.email);

    if (existingUser) {
      throw new AppError('Email already registered', 409);
    }

    const passwordHash = await bcrypt.hash(data.password, env.BCRYPT_SALT_ROUNDS);

    const user = await this.userRepository.create({
      email: data.email,
      fullName: data.fullName,
      passwordHash
    });

    return this.buildAuthResponse(user);
  }

  async login(data: LoginDto): Promise<AuthResult> {
    const user = await this.userRepository.findByEmail(data.email);

    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new AppError('Invalid credentials', 401);
    }

    return this.buildAuthResponse(user);
  }

  async getProfile(userId: string): Promise<AuthResult['user']> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      createdAt: user.createdAt
    };
  }

  private buildAuthResponse(user: User): AuthResult {
    const accessToken = jwt.sign({ email: user.email }, env.JWT_SECRET, {
      subject: user.id,
      expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn']
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        createdAt: user.createdAt
      }
    };
  }
}
