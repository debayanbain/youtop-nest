import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',
}));

export const strapiConfig = registerAs('strapi', () => ({
  url: process.env.STRAPI_URL?.replace(/\/$/, '') ?? 'http://localhost:4040',
  apiToken: process.env.STRAPI_API_TOKEN ?? '',
  cdnUrl: process.env.CDN_URL ?? '',
}));

export const redisConfig = registerAs('redis', () => ({
  url: process.env.REDIS_URL,
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
}));
