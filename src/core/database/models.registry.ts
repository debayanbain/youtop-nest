import { ModelCtor, Model } from 'sequelize-typescript';
import { User } from '../../models/user.model';
import { Order } from '../../models/order.model';
import { WebhookEvent } from '../../models/webhook-event.model';
import { ScrapeJob } from '../../models/scrape-job.model';
import { Notice } from '../../models/notice.model';

// Central list of all models
export const ALL_MODELS: ModelCtor[] = [
  User,
  Order,
  WebhookEvent,
  ScrapeJob,
  Notice,
];

export const Models = {
  User,
  Order,
  WebhookEvent,
  ScrapeJob,
  Notice,
} as const;
export type Models = typeof Models;
