import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { execSync } from 'child_process';

function freePort(port: number) {
  try {
    execSync(`lsof -ti :${port} | xargs kill -9 2>/dev/null || true`, {
      stdio: 'ignore',
    });
  } catch {
    // nothing to kill
  }
}

async function bootstrap() {
  const port = Number(process.env.PORT ?? 3001);

  // Kill any stale process occupying the port before binding
  freePort(port);

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
  console.log(`🚀 YouTOP NestJS API running on http://localhost:${port}`);
}
bootstrap().catch((err) => {
  console.error('❌ Application failed to start:', err);
});
