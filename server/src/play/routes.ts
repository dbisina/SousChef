import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DailyDateRequest, DailyGuessRequest, SetDailyPuzzlesRequest } from '@shared';
import { parse } from '../auth/schemas';
import type { AuthService } from '../auth/service';
import { viewerResolvers } from '../auth/viewer';
import type { DailyDishService } from './dailyDish';

const text = (max: number) => z.string().trim().max(max);
const dateQuery = z.object({ date: z.string().max(10).optional() }) satisfies z.ZodType<DailyDateRequest>;
const guessSchema = z.object({ guess: text(100).min(1, 'Type a dish name'), date: z.string().max(10).optional() }) satisfies z.ZodType<DailyGuessRequest>;
const puzzlesSchema = z.object({
  puzzles: z
    .array(
      z.object({
        answer: text(100).min(2),
        aliases: z.array(text(100).min(1)).max(10).optional(),
        clues: z.array(text(200).min(1)).min(1).max(6),
        photoUrl: z.url({ protocol: /^https?$/ }).max(2048).optional(),
      }),
    )
    .min(1)
    .max(400),
}) satisfies z.ZodType<SetDailyPuzzlesRequest>;

export function playRoutes(app: FastifyInstance, daily: DailyDishService, auth: AuthService): void {
  const { requireViewer, requireAdmin } = viewerResolvers(auth);

  app.get('/v1/play/daily', async (request) => daily.view((await requireViewer(request)).userId, parse(dateQuery, request.query).date));

  app.post('/v1/play/daily/clue', async (request) => daily.clue((await requireViewer(request)).userId, parse(dateQuery, request.body ?? {}).date));

  app.post('/v1/play/daily/guess', async (request) => {
    const { userId } = await requireViewer(request);
    const body = parse(guessSchema, request.body);
    return daily.guess(userId, body.guess, body.date);
  });

  app.get('/v1/play/daily/leaderboard', async (request) => ({
    items: await daily.leaderboard((await requireViewer(request)).userId, parse(dateQuery, request.query).date),
  }));

  /* ---- staff only ---- */

  app.get('/v1/admin/daily-puzzles', async (request) => {
    await requireAdmin(request);
    return { items: await daily.listPuzzles() };
  });

  app.put('/v1/admin/daily-puzzles', async (request) => {
    await requireAdmin(request);
    return { items: await daily.setPuzzles(parse(puzzlesSchema, request.body).puzzles) };
  });
}
