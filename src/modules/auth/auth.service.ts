import bcrypt from 'bcryptjs';
import { User } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/AppError';
import { issueTokens, verifyRefreshToken, signAccessToken } from '../../utils/jwt';
import { LoginInput, RegisterInput } from './auth.schemas';

const SALT_ROUNDS = 10;

/** Quita el hash de la contraseña antes de devolver el usuario. */
function sanitize(user: User) {
  const { passwordHash, ...safe } = user;
  return safe;
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw AppError.conflict('Ya existe una cuenta con este correo', 'EMAIL_TAKEN');
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  // Crea el usuario y registra el consentimiento en una transacción.
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
      },
    });

    if (input.profession) {
      await tx.professionalProfile.create({
        data: { userId: created.id, profession: input.profession },
      });
    }

    await tx.consent.create({
      data: { userId: created.id, type: 'DATA_PROCESSING', granted: true, version: '1.0' },
    });

    await tx.auditEvent.create({
      data: { userId: created.id, eventType: 'USER_REGISTERED' },
    });

    return created;
  });

  return { user: sanitize(user), ...issueTokens(user.id) };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    throw AppError.unauthorized('Correo o contraseña incorrectos', 'INVALID_CREDENTIALS');
  }

  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) {
    throw AppError.unauthorized('Correo o contraseña incorrectos', 'INVALID_CREDENTIALS');
  }

  return { user: sanitize(user), ...issueTokens(user.id) };
}

export async function refresh(refreshToken: string) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw AppError.unauthorized('Refresh token inválido o expirado', 'INVALID_REFRESH_TOKEN');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) {
    throw AppError.unauthorized('Usuario no encontrado', 'USER_NOT_FOUND');
  }

  return { accessToken: signAccessToken(user.id) };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
  if (!user) {
    throw AppError.notFound('Usuario no encontrado');
  }
  return sanitize(user);
}
