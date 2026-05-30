import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { EMAIL_QUEUE } from './queues.constants';
import { EmailJobData } from './email.producer';

@Processor(EMAIL_QUEUE, {
  stalledInterval: 60 * 60 * 1000,
  maxStalledCount: 1,
})
export class EmailConsumer extends WorkerHost {
  private readonly logger = new Logger(EmailConsumer.name);

  async process(job: Job<EmailJobData>): Promise<void> {
    const { to, template, variables } = job.data;
    this.logger.log(
      `[Email Consumer] Processing email: template=${template} to=${to} | attempt=${
        job.attemptsMade + 1
      }`,
    );

    try {
      // Simulate sending email (integrate Resend, SendGrid, etc. in real production environment)
      this.logger.log(
        `[Email Consumer] ✅ Successfully simulated sending email of template '${template}' to '${to}'`,
      );
    } catch (err: any) {
      this.logger.error(
        `[Email Consumer] ❌ Failed to send email to '${to}': ${err.message}`,
      );
      throw err;
    }
  }
}
