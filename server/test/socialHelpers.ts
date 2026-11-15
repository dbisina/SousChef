import type { AuthResponse, Post, UploadPurpose, UploadTicket } from '@shared';
import { randomUUID } from 'node:crypto';
import type { TestApp } from './helpers';
import { call } from './recipeHelpers';

/** Asks for an upload, plays the phone sending the file, and finishes it. Returns the upload id. */
export async function finishedUpload(t: TestApp, who: AuthResponse, purpose: UploadPurpose, contentType: string, size = 5000): Promise<UploadTicket> {
  const ticket = (await call(t, 'POST', '/v1/uploads', who, { purpose, contentType, size })).json<UploadTicket>();
  t.storage.put(new URL(ticket.publicUrl).pathname.slice(1), size, contentType);
  const done = await call(t, 'POST', `/v1/uploads/${ticket.id}/complete`, who);
  if (done.statusCode !== 200) throw new Error(`upload failed: ${done.statusCode} ${done.body}`);
  return ticket;
}

export async function makePost(t: TestApp, who: AuthResponse, overrides: Record<string, unknown> = {}): Promise<Post> {
  const photo = await finishedUpload(t, who, 'made_post', 'image/jpeg');
  const res = await call(t, 'POST', '/v1/posts', who, { kind: 'made-this', title: 'Sunday jollof', caption: 'Turned out great', photoUploadId: photo.id, ...overrides });
  if (res.statusCode !== 201) throw new Error(`create post failed: ${res.statusCode} ${res.body}`);
  return res.json<Post>();
}

export const newId = () => `c-${randomUUID()}`;
