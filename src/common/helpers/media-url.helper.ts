import { ConfigService } from '@nestjs/config';

export class MediaUrlHelper {
  private static strapiUrl: string;
  private static cdnUrl: string;

  static init(configService: ConfigService) {
    MediaUrlHelper.strapiUrl = (
      configService.get<string>('STRAPI_URL') || 'http://localhost:4040'
    ).replace(/\/$/, '');
    MediaUrlHelper.cdnUrl = (
      configService.get<string>('CDN_URL') || ''
    ).replace(/\/$/, '');
  }

  static resolve(url: string | null | undefined): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    const base = MediaUrlHelper.cdnUrl || MediaUrlHelper.strapiUrl;
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    return `${base}${cleanUrl}`;
  }
}
