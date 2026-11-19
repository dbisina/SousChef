import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { CreateRoomRequest, JoinRoomRequest, SubmitPlateRequest } from '@shared';
import { parse } from '../auth/schemas';
import type { AuthService } from '../auth/service';
import { viewerResolvers } from '../auth/viewer';
import { errors } from '../errors';
import type { MysteryKitchenService } from './mysteryKitchen';
import type { StepImageService } from './stepImages';

const createSchema = z.object({
  mode: z.enum(['solo', 'group']),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
}) satisfies z.ZodType<CreateRoomRequest>;
const codeSchema = z.string().regex(/^\d{4}$/, 'Room codes are 4 digits');
const joinSchema = z.object({ code: codeSchema }) satisfies z.ZodType<JoinRoomRequest>;
const paramsSchema = z.object({ code: codeSchema });
const plateSchema = z.object({
  uploadId: z.uuid(),
  note: z.string().trim().max(300).optional(),
}) satisfies z.ZodType<SubmitPlateRequest>;

export function mysteryKitchenRoutes(app: FastifyInstance, games: MysteryKitchenService, auth: AuthService, stepImages?: StepImageService): void {
  const { requireViewer } = viewerResolvers(auth);
  const roomCode = (request: { params: unknown }) => parse(paramsSchema, request.params).code;

  app.post('/v1/play/rooms', async (request, reply) => {
    const { userId } = await requireViewer(request);
    return reply.code(201).send(await games.create(userId, parse(createSchema, request.body)));
  });

  app.post('/v1/play/rooms/join', async (request) => {
    const { userId } = await requireViewer(request);
    return games.join(userId, parse(joinSchema, request.body).code);
  });

  app.get('/v1/play/rooms/:code', async (request) => games.view((await requireViewer(request)).userId, roomCode(request)));

  app.post('/v1/play/rooms/:code/start', async (request) => games.start((await requireViewer(request)).userId, roomCode(request)));

  app.post('/v1/play/rooms/:code/leave', async (request) => games.leave((await requireViewer(request)).userId, roomCode(request)));

  app.post('/v1/play/rooms/:code/hint', async (request) => games.hint((await requireViewer(request)).userId, roomCode(request)));

  /** A picture of one cooking step. Paid plans only (each picture costs money); 403 upgrade_required for everyone else. */
  app.get('/v1/play/rooms/:code/steps/:n/image', async (request) => {
    const { userId } = await requireViewer(request);
    const { n } = parse(z.object({ n: z.coerce.number().int().min(0).max(30) }), request.params);
    if (!stepImages) throw errors.aiUnavailable('Step pictures are not available right now');
    return stepImages.forStep(userId, roomCode(request), n);
  });

  app.post('/v1/play/rooms/:code/plate', async (request) => {
    const { userId } = await requireViewer(request);
    return games.plate(userId, roomCode(request), parse(plateSchema, request.body));
  });
}
