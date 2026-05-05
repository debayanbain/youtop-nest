import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';

async function bootstrap() {
  const port = Number(process.env.PORT ?? 3001);

  const app = await NestFactory.create(AppModule, {
    rawBody: true,
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

  app.use(helmet());
  app.use(compression());

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.listen(port);
  console.log(
    `🚀 YouTOP NestJS API running on http://localhost:${port}`,
    `🚀 YouTOP NestJS BullMQ UI running on http://localhost:${port}/queues`,
  );
}
bootstrap().catch((err) => {
  console.error('❌ Application failed to start:', err);
});
