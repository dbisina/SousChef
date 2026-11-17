import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { FEED_EVENT_KINDS, type RecordFeedEventsRequest } from '@shared';
import { parse } from '../auth/schemas';
import type { AuthService } from '../auth/service';
import { viewerResolvers } from '../auth/viewer';
import type { Config } from '../config';
import type { FeedEventService } from './events';

const eventsSchema = z.object({
  events: z
    .array(
      z.object({
        kind: z.enum(FEED_EVENT_KINDS),
        postId: z.uuid().optional(),
        recipeId: z.uuid().optional(),
        dwellMs: z.number().int().min(0).max(24 * 3_600_000).optional(),
      }),
    )
    .max(50),
}) satisfies z.ZodType<RecordFeedEventsRequest>;

const preferencesSchema = z.object({ personalised: z.boolean() });

export function recommendRoutes(app: FastifyInstance, events: FeedEventService, auth: AuthService, config: Config): void {
  const { requireViewer } = viewerResolvers(auth);
  // The app reports in small batches in the background: generous, but a stuck loop cannot hammer the database.
  const batching = { config: { rateLimit: { max: Math.min(config.RATE_LIMIT_MAX, 30), timeWindow: '1 minute' } } };

  app.post('/v1/feed/events', batching, async (request) => {
    const viewer = await requireViewer(request);
    return events.record(viewer.userId, parse(eventsSchema, request.body).events);
  });

  app.get('/v1/me/feed-preferences', async (request) => events.preferences((await requireViewer(request)).userId));

  app.put('/v1/me/feed-preferences', async (request) => {
    const viewer = await requireViewer(request);
    return events.setPersonalised(viewer.userId, parse(preferencesSchema, request.body).personalised);
  });
}
