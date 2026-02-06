import { Cloudinary } from '@cloudinary/url-gen';

// Cloudinary configuration
const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || '';
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || '';

// Initialize Cloudinary instance for URL generation
export const cloudinary = new Cloudinary({
  cloud: {
    cloudName: CLOUD_NAME,
  },
});

// Cloudinary upload API endpoint
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

/**
 * Upload an image to Cloudinary
 * @param uri - Local image URI (from camera or gallery)
 * @param folder - Optional folder path in Cloudinary (default: 'souschef/recipes')
 * @returns Promise with the secure URL of the uploaded image
 */
export const uploadImage = async (
  uri: string,
  folder: string = 'souschef/recipes'
): Promise<string> => {
  // Create form data for upload
  const formData = new FormData();

  // Get the file extension
  const uriParts = uri.split('.');
  const fileType = uriParts[uriParts.length - 1];

  // Append the image file
  formData.append('file', {
    uri,
    type: `image/${fileType === 'jpg' ? 'jpeg' : fileType}`,
    name: `upload.${fileType}`,
  } as unknown as Blob);

  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', folder);

  // Upload to Cloudinary
  const response = await fetch(UPLOAD_URL, {
    method: 'POST',
    body: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Failed to upload image to Cloudinary');
  }

  const data = await response.json();
  return data.secure_url;
};

/**
 * Extract public ID from a Cloudinary URL
 * @param url - Cloudinary image URL
 * @returns The public ID or null if not a valid Cloudinary URL
 */
export const extractPublicId = (url: string): string | null => {
  if (!url.includes('cloudinary.com')) {
    return null;
  }

  // Cloudinary URL format: https://res.cloudinary.com/{cloud_name}/image/upload/{version}/{public_id}.{format}
  const regex = /\/upload\/(?:v\d+\/)?(.+?)\.[^.]+$/;
  const match = url.match(regex);

  return match ? match[1] : null;
};

/**
 * Delete an image from Cloudinary
 * Note: This requires a server-side implementation with signed requests
 * For now, we log the request - actual deletion should happen via backend/cloud function
 * @param publicId - The public ID of the image to delete
 */
export const deleteImage = async (publicId: string): Promise<void> => {
  // Cloudinary deletion requires signed requests (API secret)
  // This should be implemented via a server-side function for security
  // For now, we'll just log this - images can be managed via Cloudinary dashboard
  console.log(`[Cloudinary] Image deletion requested for: ${publicId}`);
  console.log('[Cloudinary] Note: Implement server-side deletion for production');
};

/**
 * Delete an image by its URL
 * @param url - The Cloudinary URL of the image to delete
 */
export const deleteImageByUrl = async (url: string): Promise<void> => {
  const publicId = extractPublicId(url);
  if (publicId) {
    await deleteImage(publicId);
  }
};

/**
 * Check if a URL is a Cloudinary URL
 * @param url - URL to check
 * @returns true if it's a Cloudinary URL
 */
export const isCloudinaryUrl = (url: string): boolean => {
  return url.includes('cloudinary.com');
};
