import { type User } from '../domain/User.js';

export interface CreateUserData {
  email: string;
  fullName: string;
  passwordHash: string;
}

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(data: CreateUserData): Promise<User>;
}
