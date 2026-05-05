import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { UsersService } from '../modules/users/users.service';
import { PostgresService } from '../core/database/postgres.service';
import { CLERK_WEBHOOKS_QUEUE } from './queues.constants';
import { ClerkWebhookJobData } from './clerk-webhook.producer';

interface ClerkUserJSON {
  id: string;
  email_addresses: Array<{ email_address: string }>;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
}

@Processor(CLERK_WEBHOOKS_QUEUE, {
  stalledInterval: 60 * 60 * 1000, // Check for stalled jobs every 1 hour
  maxStalledCount: 1,
})
export class ClerkWebhookConsumer extends WorkerHost {
  private readonly logger = new Logger(ClerkWebhookConsumer.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly dbService: PostgresService,
  ) {
    super();
  }

  async process(job: Job<ClerkWebhookJobData>): Promise<void> {
    const { svixId, webhookEventId, eventType, eventData } = job.data;

    this.logger.log(
      `[Consumer] Processing ${eventType} | svixId=${svixId} | attempt=${job.attemptsMade + 1}`,
    );

    try {
      if (eventType === 'user.created') {
        await this.usersService.findOrCreateFromClerk(
          eventData as unknown as ClerkUserJSON,
        );
      }

      if (eventType === 'user.updated') {
        await this.usersService.updateFromClerk(
          eventData as unknown as ClerkUserJSON,
        );
      }

      if (eventType === 'user.deleted') {
        const id = (eventData as { id?: string }).id;
        if (id) {
          await this.usersService.softDeleteFromClerk(id);
        }
      }

      // Mark event as successfully processed
      await this.dbService.getConnection();
      await this.dbService.models.WebhookEvent.update(
        { processed: true },
        { where: { id: webhookEventId } },
      );

      this.logger.log(
        `[Consumer] ✅ Processed ${eventType} | svixId=${svixId}`,
      );
    } catch (err) {
      const message = (err as Error).message;
      this.logger.error(
        `[Consumer] ❌ Failed ${eventType} | svixId=${svixId} | attempt=${job.attemptsMade + 1} | ${message}`,
      );

      // On final attempt, save error to the webhook_events row
      if (job.attemptsMade + 1 >= (job.opts.attempts ?? 5)) {
        await this.dbService.getConnection();
        await this.dbService.models.WebhookEvent.update(
          { errorMessage: message },
          { where: { id: webhookEventId } },
        ).catch(() => {
          /* don't throw in error handler */
        });
      }

      // Re-throw so BullMQ knows to retry
      throw err;
    }
  }
}
