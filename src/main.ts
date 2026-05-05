import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const port = Number(process.env.PORT ?? 3001);

  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  app.use(cookieParser());

  app.enableCors({
    origin: [
      'http://localhost:3000',
      process.env.FRONTEND_URL ?? 'http://localhost:3000',
    ],
    credentials: true,
  });

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
