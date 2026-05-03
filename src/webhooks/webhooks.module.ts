import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { QueuesModule } from '../queues/queues.module';

@Module({
  imports: [QueuesModule],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
