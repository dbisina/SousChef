import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { SoloAnswerRequest } from '@shared';
import { parse } from '../auth/schemas';
import type { AuthService } from '../auth/service';
import { viewerResolvers } from '../auth/viewer';
import type { SoloGameService } from './solo';

const params = z.object({ game: z.string().max(20) });
const answerSchema = z.object({
  token: z.string().min(20).max(20_000),
  answers: z.array(z.union([z.number().int().min(0).max(50), z.array(z.number().int().min(0).max(50)).max(20)])).max(30),
}) satisfies z.ZodType<SoloAnswerRequest>;

export function soloRoutes(app: FastifyInstance, solo: SoloGameService, auth: AuthService): void {
  const { requireViewer } = viewerResolvers(auth);

  app.get('/v1/play/solo', async (request) => ({ items: await solo.list((await requireViewer(request)).userId) }));

  app.post('/v1/play/solo/:game/start', async (request) => {
    const { userId } = await requireViewer(request);
    return solo.start(userId, solo.gameId(parse(params, request.params).game));
  });

  app.post('/v1/play/solo/:game/answer', async (request) => {
    const { userId } = await requireViewer(request);
    return solo.answer(userId, solo.gameId(parse(params, request.params).game), parse(answerSchema, request.body));
  });

  app.get('/v1/play/solo/:game/leaderboard', async (request) => {
    const { userId } = await requireViewer(request);
    return { items: await solo.leaderboard(userId, solo.gameId(parse(params, request.params).game)) };
  });
}
