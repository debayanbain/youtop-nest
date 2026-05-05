import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CLERK_WEBHOOKS_QUEUE } from './queues.constants';

export interface ClerkWebhookJobData {
  svixId: string;
  webhookEventId: number; // DB row ID in webhook_events for marking processed
  eventType: string;
  eventData: Record<string, unknown>;
}

@Injectable()
export class ClerkWebhookProducer {
  private readonly logger = new Logger(ClerkWebhookProducer.name);

  constructor(
    @InjectQueue(CLERK_WEBHOOKS_QUEUE) private readonly queue: Queue,
  ) {}

  async push(data: ClerkWebhookJobData): Promise<void> {
    await this.queue.add('clerk-event', data, {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 1000, // 1s, 2s, 4s, 8s, 16s
      },
      removeOnComplete: {
        age: 24 * 3600, // keep for 24 hours
        count: 20, // keep last 20 jobs
      },
      removeOnFail: {
        age: 24 * 3600, // keep failed jobs for 24 hours
      },
    });

    this.logger.log(
      `[Queue] Pushed ${data.eventType} for svixId=${data.svixId}`,
    );
  }
}
