// Sending a photo or voice note to the enplace server's file store (replaces Cloudinary when EXPO_PUBLIC_API_URL is set).
// Three steps: ask the server for a short-lived upload link, send the bytes straight there, then tell the server it is done.
import type { CreateUploadRequest, UploadPurpose, UploadTicket, Upload } from '@shared/index';
import { api } from '@/lib/api';

export interface UploadedFile {
  /** Pass this where a feature takes an `uploadId` (posts, stories, chat). */
  id: string;
  /** Where the file is served from. Pass this where a feature takes an image address (recipes). */
  url: string;
}

/**
 * Uploads the file at `uri` (a local file or blob address from the camera, picker or recorder).
 * `contentType` defaults to what the file says it is, and falls back to JPEG for photos.
 */
export async function uploadFile(uri: string, purpose: UploadPurpose, contentType?: string): Promise<UploadedFile> {
  const bytes = await (await fetch(uri)).blob();
  const type = contentType || bytes.type || 'image/jpeg';
  const request: CreateUploadRequest = { purpose, contentType: type, size: bytes.size };
  const ticket = await api().post<UploadTicket>('/v1/uploads', request);

  // Straight to the file store: no sign-in header, exactly the headers the link was made for.
  const sent = await fetch(ticket.uploadUrl, { method: 'PUT', headers: ticket.headers, body: bytes });
  if (!sent.ok) throw new Error(`The upload did not go through (${sent.status})`);

  const done = await api().post<Upload>(`/v1/uploads/${ticket.id}/complete`);
  return { id: done.id, url: done.url || ticket.publicUrl };
}
