import { deliveryUrl, optimizedSource, widthBucket } from '@/lib/mediaUrl';

afterEach(() => {
  delete process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
  delete process.env.EXPO_PUBLIC_MEDIA_HOSTS;
});

describe('delivery through Cloudinary', () => {
  it('changes nothing until a Cloudinary name is set', () => {
    delete process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
    process.env.EXPO_PUBLIC_MEDIA_HOSTS = 'media.example.com';
    expect(deliveryUrl('https://media.example.com/a.jpg', 300)).toBe('https://media.example.com/a.jpg');
  });

  it('asks Cloudinary for a resized copy of a picture on one of our media hosts', () => {
    process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME = 'souschef';
    process.env.EXPO_PUBLIC_MEDIA_HOSTS = 'media.example.com, old-bucket.example.net';
    expect(deliveryUrl('https://media.example.com/recipes/a.jpg', 150)).toBe('https://res.cloudinary.com/souschef/image/fetch/f_auto,q_auto,c_limit,w_320/https://media.example.com/recipes/a.jpg');
    expect(deliveryUrl('https://old-bucket.example.net/x/y.png', 400, 1)).toContain('w_480');
    expect(deliveryUrl('https://media.example.com/a.jpg?v=2', 100, 1)).toContain(encodeURIComponent('https://media.example.com/a.jpg?v=2'));
  });

  it('leaves other pictures alone: other sites, phone files, data addresses, bundled images', () => {
    process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME = 'souschef';
    process.env.EXPO_PUBLIC_MEDIA_HOSTS = 'media.example.com';
    expect(deliveryUrl('https://other.example.com/a.jpg', 300)).toBe('https://other.example.com/a.jpg');
    expect(deliveryUrl('file:///photos/a.jpg', 300)).toBe('file:///photos/a.jpg');
    expect(deliveryUrl('http://media.example.com/a.jpg', 300)).toBe('http://media.example.com/a.jpg');
    expect(optimizedSource(7, 300)).toBe(7);
    const src = { uri: 'https://other.example.com/a.jpg' };
    expect(optimizedSource(src, 300)).toBe(src);
  });

  it('rounds to a few standard widths so the same sizes are reused', () => {
    expect(widthBucket(50)).toBe(96);
    expect(widthBucket(161)).toBe(320);
    expect(widthBucket(5000)).toBe(1280);
  });
});
