import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import { MediaUrlHelper } from './common/helpers/media-url.helper';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';

async function bootstrap() {
  const port = Number(process.env.PORT ?? 3001);

  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  // Set global API prefix
  app.setGlobalPrefix('api');

  // Enable API versioning (e.g., /api/v1/courses)
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.use(cookieParser());

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'https://www.youtop.store',
      'https://youtop.store',
      process.env.FRONTEND_URL,
    ].filter(Boolean),
    credentials: true,
  });

  // Helmet config with custom CSP rules
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: [
            "'self'",
            'data:',
            'https://res.cloudinary.com',
            'https://cdn.youtop.store',
          ],
          scriptSrc: ["'self'"],
        },
      },
      hsts: { maxAge: 31536000, includeSubDomains: true },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  app.use(compression());

  // Bind global pipes
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Bind global Exception Filters and Response Interceptors
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ResponseTransformInterceptor());

  // Initialize static MediaUrlHelper
  const configService = app.get(ConfigService);
  MediaUrlHelper.init(configService);

  await app.listen(port);
  console.log(
    `🚀 YouTOP NestJS API running on http://localhost:${port}`,
    `🚀 YouTOP NestJS BullMQ UI running on http://localhost:${port}/queues`,
  );
}
bootstrap().catch((err) => {
  console.error('❌ Application failed to start:', err);
});
