import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EMAIL_QUEUE } from './queues.constants';

export interface EmailJobData {
  to: string;
  template: 'purchase-confirmation' | 'welcome' | 'password-reset';
  variables: Record<string, string>;
}

@Injectable()
export class EmailProducer {
  private readonly logger = new Logger(EmailProducer.name);

  constructor(@InjectQueue(EMAIL_QUEUE) private readonly emailQueue: Queue) {}

  async sendEmail(data: EmailJobData): Promise<void> {
    try {
      await this.emailQueue.add('send-email', data, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 200,
      });
      this.logger.debug(`Enqueued email job to: ${data.to}`);
    } catch (err) {
      this.logger.error(`Failed to enqueue email job to: ${data.to}`, err);
      throw err;
    }
  }
}
