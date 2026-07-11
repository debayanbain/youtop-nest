import { ConfigService } from '@nestjs/config';
import { MediaUrlHelper } from './media-url.helper';

function configWith(values: Record<string, string | undefined>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('MediaUrlHelper', () => {
  describe('resolve', () => {
    beforeEach(() => {
      MediaUrlHelper.init(
        configWith({ STRAPI_URL: 'http://strapi:4040', CDN_URL: '' }),
      );
    });

    it('returns "" for empty input', () => {
      expect(MediaUrlHelper.resolve(undefined)).toBe('');
      expect(MediaUrlHelper.resolve(null)).toBe('');
      expect(MediaUrlHelper.resolve('')).toBe('');
    });

    it('passes absolute and data URLs through unchanged', () => {
      expect(MediaUrlHelper.resolve('https://x.com/a.png')).toBe(
        'https://x.com/a.png',
      );
      expect(MediaUrlHelper.resolve('data:image/svg+xml,<svg/>')).toBe(
        'data:image/svg+xml,<svg/>',
      );
    });

    it('prefixes relative paths with the base and normalizes the slash', () => {
      expect(MediaUrlHelper.resolve('/uploads/a.png')).toBe(
        'http://strapi:4040/uploads/a.png',
      );
      expect(MediaUrlHelper.resolve('uploads/a.png')).toBe(
        'http://strapi:4040/uploads/a.png',
      );
    });

    it('prefers CDN_URL over STRAPI_URL when both are set', () => {
      MediaUrlHelper.init(
        configWith({
          STRAPI_URL: 'http://strapi:4040',
          CDN_URL: 'https://cdn.example.com/',
        }),
      );
      expect(MediaUrlHelper.resolve('/uploads/a.png')).toBe(
        'https://cdn.example.com/uploads/a.png',
      );
    });
  });

  describe('image', () => {
    it('returns the resolved URL when the asset exists', () => {
      MediaUrlHelper.init(configWith({ STRAPI_URL: 'http://strapi:4040' }));
      expect(MediaUrlHelper.image('/uploads/a.png')).toBe(
        'http://strapi:4040/uploads/a.png',
      );
    });

    it('never returns an empty string — falls back to the default placeholder', () => {
      MediaUrlHelper.init(configWith({ STRAPI_URL: 'http://strapi:4040' }));
      const result = MediaUrlHelper.image(undefined);
      expect(result).not.toBe('');
      expect(result.startsWith('data:image/svg+xml')).toBe(true);
    });

    it('uses PLACEHOLDER_IMAGE_URL when configured', () => {
      MediaUrlHelper.init(
        configWith({
          STRAPI_URL: 'http://strapi:4040',
          PLACEHOLDER_IMAGE_URL: 'https://cdn.example.com/fallback.png',
        }),
      );
      expect(MediaUrlHelper.image(null)).toBe(
        'https://cdn.example.com/fallback.png',
      );
    });

    it('resolves a relative PLACEHOLDER_IMAGE_URL against the base', () => {
      MediaUrlHelper.init(
        configWith({
          STRAPI_URL: 'http://strapi:4040',
          PLACEHOLDER_IMAGE_URL: '/placeholder.png',
        }),
      );
      expect(MediaUrlHelper.image('')).toBe(
        'http://strapi:4040/placeholder.png',
      );
    });
  });
});
