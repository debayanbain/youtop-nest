import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClerkWebhookProducer } from '../queues/clerk-webhook.producer';
import { ClerkWebhookConsumer } from '../queues/clerk-webhook.consumer';
import { UsersModule } from '../modules/users/users.module';

import { CLERK_WEBHOOKS_QUEUE } from './queues.constants';

export { CLERK_WEBHOOKS_QUEUE };

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL');
        if (redisUrl) {
          return { connection: { url: redisUrl } };
        }
        // Fallback to localhost for local development
        return {
          connection: {
            host: config.get<string>('REDIS_HOST', 'localhost'),
            port: config.get<number>('REDIS_PORT', 6379),
          },
        };
      },
    }),
    BullModule.registerQueue({ name: CLERK_WEBHOOKS_QUEUE }),
    UsersModule,
  ],
  providers: [ClerkWebhookProducer, ClerkWebhookConsumer],
  exports: [ClerkWebhookProducer],
})
export class QueuesModule {}
