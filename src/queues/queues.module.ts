import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClerkWebhookProducer } from '../queues/clerk-webhook.producer';
import { ClerkWebhookConsumer } from '../queues/clerk-webhook.consumer';
import { EmailProducer } from './email.producer';
import { EmailConsumer } from './email.consumer';
import { UsersModule } from '../modules/users/users.module';

import {
  CLERK_WEBHOOKS_QUEUE,
  EMAIL_QUEUE,
  ANALYTICS_QUEUE,
} from './queues.constants';

import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';

export { CLERK_WEBHOOKS_QUEUE, EMAIL_QUEUE, ANALYTICS_QUEUE };

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
        return {
          connection: {
            host: config.get<string>('REDIS_HOST', 'localhost'),
            port: config.get<number>('REDIS_PORT', 6379),
            ...commonOptions,
          },
        };
      },
    }),
    BullModule.registerQueue(
      { name: CLERK_WEBHOOKS_QUEUE },
      { name: EMAIL_QUEUE },
      { name: ANALYTICS_QUEUE },
    ),
    BullBoardModule.forRoot({
      route: '/queues',
      adapter: ExpressAdapter,
    }),
    BullBoardModule.forFeature(
      {
        name: CLERK_WEBHOOKS_QUEUE,
        adapter: BullMQAdapter,
      },
      {
        name: EMAIL_QUEUE,
        adapter: BullMQAdapter,
      },
      {
        name: ANALYTICS_QUEUE,
        adapter: BullMQAdapter,
      },
    ),
    UsersModule,
  ],
  providers: [
    ClerkWebhookProducer,
    ClerkWebhookConsumer,
    EmailProducer,
    EmailConsumer,
  ],
  exports: [ClerkWebhookProducer, EmailProducer],
})
export class QueuesModule {}
