import { ConfigService } from '@nestjs/config';

/**
 * Neutral 400x300 placeholder as an inline SVG data URI.
 *
 * Used when a Strapi asset is missing so image fields never resolve to an
 * empty string. A data URI is deliberate: it always renders, needs no CDN
 * upload, and works with `next/image` without any extra `remotePatterns`
 * config. Override in production via `PLACEHOLDER_IMAGE_URL`.
 */
const DEFAULT_PLACEHOLDER =
  'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">' +
      '<rect width="400" height="300" fill="#e5e7eb"/>' +
      '<circle cx="155" cy="120" r="20" fill="#cbd5e1"/>' +
      '<path d="M110 210l55-70 40 48 30-32 55 54z" fill="#cbd5e1"/>' +
      '</svg>',
  );

export class MediaUrlHelper {
  private static strapiUrl = '';
  private static cdnUrl = '';
  private static placeholder = DEFAULT_PLACEHOLDER;

  static init(configService: ConfigService) {
    MediaUrlHelper.strapiUrl = (
      configService.get<string>('STRAPI_URL') || 'http://localhost:4040'
    ).replace(/\/$/, '');
    MediaUrlHelper.cdnUrl = (
      configService.get<string>('CDN_URL') || ''
    ).replace(/\/$/, '');

    const configured = configService.get<string>('PLACEHOLDER_IMAGE_URL');
    MediaUrlHelper.placeholder = configured
      ? MediaUrlHelper.resolve(configured)
      : DEFAULT_PLACEHOLDER;
  }

  /**
   * Resolve a Strapi media path to an absolute URL.
   * Returns `''` for empty input — prefer {@link image} for `<img>` /
   * `next/image` fields, which never returns an empty string.
   */
  static resolve(url: string | null | undefined): string {
    if (!url) return '';
    if (
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('data:')
    ) {
      return url;
    }
    const base = MediaUrlHelper.cdnUrl || MediaUrlHelper.strapiUrl;
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    return `${base}${cleanUrl}`;
  }

  /**
   * Resolve a media path for an image field, guaranteeing a non-empty result.
   *
   * Falls back to the configured placeholder when the asset is missing, so the
   * frontend always receives a valid `src`. An empty/undefined `src` makes
   * `next/image` throw ("empty string passed to src" / "missing required src")
   * and the optimizer return `400` — this is the seam that prevents that.
   */
  static image(url: string | null | undefined): string {
    return MediaUrlHelper.resolve(url) || MediaUrlHelper.placeholder;
  }
}
