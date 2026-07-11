import { Global, Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from './winston.config';

/**
 * Centralized logging. Registers a single Winston instance app-wide.
 *
 * - `main.ts` calls `app.useLogger(...)` so every Nest `Logger` and framework
 *   log routes through this one instance (console + rotating files in ./logs).
 * - Inject the raw winston logger anywhere with
 *   `@Inject(WINSTON_MODULE_NEST_PROVIDER)` for structured logging.
 */
@Global()
@Module({
  imports: [WinstonModule.forRoot(winstonConfig)],
  exports: [WinstonModule],
})
export class LoggerModule {}
