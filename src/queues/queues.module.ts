import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClerkWebhookProducer } from '../queues/clerk-webhook.producer';
import { ClerkWebhookConsumer } from '../queues/clerk-webhook.consumer';
import { UsersModule } from '../modules/users/users.module';

import { CLERK_WEBHOOKS_QUEUE } from './queues.constants';

import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';

export { CLERK_WEBHOOKS_QUEUE };

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL');
        const commonOptions = {
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
        };

        if (redisUrl) {
          return {
            connection: {
              url: redisUrl,
              ...commonOptions,
            },
          };
        }
        // Fallback to localhost for local development
        return {
          connection: {
            host: config.get<string>('REDIS_HOST', 'localhost'),
            port: config.get<number>('REDIS_PORT', 6379),
            ...commonOptions,
          },
        };
      },
    }),
    BullModule.registerQueue({ name: CLERK_WEBHOOKS_QUEUE }),
    BullBoardModule.forRoot({
      route: '/queues',
      adapter: ExpressAdapter,
    }),
    BullBoardModule.forFeature({
      name: CLERK_WEBHOOKS_QUEUE,
      adapter: BullMQAdapter,
    }),
    UsersModule,
  ],
  providers: [ClerkWebhookProducer, ClerkWebhookConsumer],
  exports: [ClerkWebhookProducer],
})
export class QueuesModule {}
