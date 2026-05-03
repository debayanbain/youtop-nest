import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  RawBody,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Webhook } from 'svix';
import { WebhookEvent } from '@clerk/backend';
import { PostgresService } from '../core/database/postgres.service';
import { ClerkWebhookProducer } from '../queues/clerk-webhook.producer';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly dbService: PostgresService,
    private readonly producer: ClerkWebhookProducer,
  ) {}

  @Post('clerk')
  @HttpCode(200)
  async handleClerkWebhook(
    @RawBody() rawBody: Buffer,
    @Headers('svix-id') svixId: string,
    @Headers('svix-timestamp') svixTimestamp: string,
    @Headers('svix-signature') svixSignature: string,
  ) {
    const secret = this.configService.getOrThrow<string>(
      'CLERK_WEBHOOK_SECRET',
    );

    if (!svixId || !svixTimestamp || !svixSignature) {
      throw new BadRequestException('Missing svix headers');
    }

    // ─── 1. Verify signature ────────────────────────────────────────────────
    const wh = new Webhook(secret.replace('whsec_', ''));
    let evt: WebhookEvent;

    try {
      evt = wh.verify(rawBody, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as WebhookEvent;
    } catch (err) {
      this.logger.error('Webhook verification failed', err);
      throw new BadRequestException('Webhook verification failed');
    }

    // ─── 2. Idempotency check ───────────────────────────────────────────────
    const existingEvent = await this.dbService.models.WebhookEvent.findOne({
      where: { svixId },
    });

    if (existingEvent?.processed) {
      this.logger.warn(`Duplicate webhook ${svixId} — skipping`);
      return { received: true };
    }

    // ─── 3. Save raw event to DB (audit log + idempotency anchor) ──────────
    const record = await this.dbService.models.WebhookEvent.create({
      svixId,
      eventType: evt.type,
      payload: evt as unknown as Record<string, unknown>,
      processed: false,
    });

    // ─── 4. Push to queue — returns in <1ms ────────────────────────────────
    await this.producer.push({
      svixId,
      webhookEventId: record.id,
      eventType: evt.type,
      eventData: evt.data as unknown as Record<string, unknown>,
    });

    this.logger.log(`[Webhook] Queued ${evt.type} | svixId=${svixId}`);

    // Return 200 immediately — consumer handles processing asynchronously
    return { received: true };
  }
}
