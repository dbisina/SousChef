// Files people upload (photos, voice notes). The phone sends them straight to the file store with a short-lived link
// from the server; the server never handles the bytes.

export const UPLOAD_PURPOSES = ['recipe_image', 'made_post', 'avatar', 'story', 'chat_image', 'voice', 'post_video', 'import_frame'] as const;
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const VIDEO_TYPES = ['video/mp4', 'video/quicktime'] as const;
const AUDIO_TYPES = ['audio/mp4', 'audio/aac', 'audio/mpeg', 'audio/ogg', 'audio/webm'] as const;

/** What each kind of upload may be. The phone compresses first; these are the ceilings. */
export const UPLOAD_RULES: Record<UploadPurpose, { maxBytes: number; contentTypes: readonly string[] }> = {
  recipe_image: { maxBytes: 5 * 1024 * 1024, contentTypes: IMAGE_TYPES },
  made_post: { maxBytes: 5 * 1024 * 1024, contentTypes: IMAGE_TYPES },
  avatar: { maxBytes: 2 * 1024 * 1024, contentTypes: IMAGE_TYPES },
  story: { maxBytes: 5 * 1024 * 1024, contentTypes: IMAGE_TYPES },
  chat_image: { maxBytes: 5 * 1024 * 1024, contentTypes: IMAGE_TYPES },
  // About 180 KB a minute, so a few minutes fit comfortably.
  voice: { maxBytes: 1024 * 1024, contentTypes: AUDIO_TYPES },
  // Short clips, compressed on the phone first.
  post_video: { maxBytes: 20 * 1024 * 1024, contentTypes: VIDEO_TYPES },
  // A frame from a cooking video, shrunk on the phone; read once by the AI and then deleted.
  import_frame: { maxBytes: 2 * 1024 * 1024, contentTypes: IMAGE_TYPES },
};

export interface CreateUploadRequest {
  purpose: UploadPurpose;
  contentType: string;
  /** Size in bytes of the file about to be sent. */
  size: number;
}

/** Everything the phone needs to send the file: PUT the bytes to `uploadUrl` with exactly these headers. */
export interface UploadTicket {
  id: string;
  uploadUrl: string;
  headers: Record<string, string>;
  /** Where the file will be served from once it is complete. */
  publicUrl: string;
  expiresAt: string;
}

export type UploadStatus = 'pending' | 'ready' | 'deleted';

export interface Upload {
  id: string;
  purpose: UploadPurpose;
  contentType: string;
  size: number;
  url: string;
  status: UploadStatus;
}
