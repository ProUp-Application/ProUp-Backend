import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../src/app.js';

describe('Authentication API', () => {
  it('registers and logs in a user', async () => {
    const registerResponse = await request(app).post('/api/auth/register').send({
      fullName: 'Jane Doe',
      email: 'jane@example.com',
      password: 'StrongPass1'
    });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.accessToken).toBeTypeOf('string');

    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'jane@example.com',
      password: 'StrongPass1'
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.user.email).toBe('jane@example.com');
  });

  it('returns profile for authenticated users', async () => {
    const registerResponse = await request(app).post('/api/auth/register').send({
      fullName: 'John Doe',
      email: 'john@example.com',
      password: 'AnotherPass1'
    });

    const token = registerResponse.body.accessToken;

    const profileResponse = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', ['Bearer', token].join(' '));

    expect(profileResponse.status).toBe(200);
    expect(profileResponse.body.email).toBe('john@example.com');
  });

  it('rejects weak passwords', async () => {
    const response = await request(app).post('/api/auth/register').send({
      fullName: 'Weak Password',
      email: 'weak@example.com',
      password: 'weak'
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Validation error');
  });
});
