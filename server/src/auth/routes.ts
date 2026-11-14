import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Config } from '../config';
import { errors } from '../errors';
import type { AccessClaims } from './tokens';
import type { AuthService } from './service';
import {
  deleteAccountSchema,
  forgotSchema,
  loginSchema,
  logoutSchema,
  parse,
  refreshSchema,
  registerDeviceSchema,
  registerSchema,
  resetSchema,
  socialSchema,
  updateProfileSchema,
} from './schemas';

declare module 'fastify' {
  interface FastifyRequest {
    auth: AccessClaims | null;
  }
}

export function authRoutes(app: FastifyInstance, service: AuthService, config: Config): void {
  // Sign-in endpoints are hit by anyone, so they get a much tighter limit than the rest of the API.
  const strict = { config: { rateLimit: { max: config.AUTH_RATE_LIMIT_MAX, timeWindow: '1 minute' } } };

  app.decorateRequest('auth', null);

  const requireAuth = async (request: FastifyRequest): Promise<AccessClaims> => {
    const claims = await service.authenticate(request.headers.authorization);
    if (!claims) throw errors.unauthorized();
    request.auth = claims;
    return claims;
  };

  app.post('/v1/auth/register', strict, async (request, reply) =>
    reply.code(201).send(await service.register(parse(registerSchema, request.body))),
  );

  app.post('/v1/auth/login', strict, async (request) => service.login(parse(loginSchema, request.body)));

  app.post('/v1/auth/social', strict, async (request) => service.socialLogin(parse(socialSchema, request.body)));

  app.post('/v1/auth/refresh', strict, async (request) => service.refresh(parse(refreshSchema, request.body).refreshToken));

  app.post('/v1/auth/logout', async (request, reply) => {
    await service.logout(parse(logoutSchema, request.body).refreshToken);
    return reply.code(204).send();
  });

  app.post('/v1/auth/logout-all', async (request, reply) => {
    const { userId } = await requireAuth(request);
    await service.logoutAll(userId);
    return reply.code(204).send();
  });

  // Same reply whether or not the address has an account.
  app.post('/v1/auth/forgot-password', strict, async (request, reply) => {
    await service.forgotPassword(parse(forgotSchema, request.body).email);
    return reply.code(202).send({ ok: true });
  });

  app.post('/v1/auth/reset-password', strict, async (request, reply) => {
    await service.resetPassword(parse(resetSchema, request.body));
    return reply.code(204).send();
  });

  app.get('/v1/me', async (request) => service.me((await requireAuth(request)).userId));

  app.patch('/v1/me', async (request) => {
    const { userId } = await requireAuth(request);
    return service.updateProfile(userId, parse(updateProfileSchema, request.body));
  });

  app.delete('/v1/me', async (request, reply) => {
    const { userId } = await requireAuth(request);
    await service.deleteAccount(userId, parse(deleteAccountSchema, request.body));
    return reply.code(204).send();
  });

  app.put('/v1/me/devices', async (request, reply) => {
    const { userId } = await requireAuth(request);
    await service.registerDevice(userId, parse(registerDeviceSchema, request.body));
    return reply.code(204).send();
  });

  app.delete<{ Params: { pushToken: string } }>('/v1/me/devices/:pushToken', async (request, reply) => {
    const { userId } = await requireAuth(request);
    await service.removeDevice(userId, request.params.pushToken);
    return reply.code(204).send();
  });
}
