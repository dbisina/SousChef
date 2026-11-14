import type { FastifyRequest } from 'fastify';
import type { UserRole } from '@shared';
import { errors } from '../errors';
import type { AuthService } from './service';

export interface Viewer {
  userId: string;
  role: UserRole;
}

/** How routes find out who is asking. */
export function viewerResolvers(auth: AuthService) {
  return {
    /** The signed-in person, or a 401. */
    async requireViewer(request: FastifyRequest): Promise<Viewer> {
      const claims = await auth.authenticate(request.headers.authorization);
      if (!claims) throw errors.unauthorized();
      return { userId: claims.userId, role: claims.role };
    },
    /** For pages anyone can open: a valid sign-in adds personal details, anything else is treated as signed out. */
    async optionalViewer(request: FastifyRequest): Promise<Viewer | null> {
      const claims = await auth.authenticate(request.headers.authorization);
      return claims ? { userId: claims.userId, role: claims.role } : null;
    },
  };
}
