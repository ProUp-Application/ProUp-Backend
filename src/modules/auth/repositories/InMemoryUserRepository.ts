import { randomUUID } from 'node:crypto';
import { type User } from '../domain/User.js';
import { type CreateUserData, type UserRepository } from './UserRepository.js';

export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, User>();

  async findByEmail(email: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return user;
      }
    }

    return null;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async create(data: CreateUserData): Promise<User> {
    const now = new Date();
    const user: User = {
      id: randomUUID(),
      email: data.email,
      fullName: data.fullName,
      passwordHash: data.passwordHash,
      createdAt: now,
      updatedAt: now
    };

    this.users.set(user.id, user);

    return user;
  }
}
