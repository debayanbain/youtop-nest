import { ModelCtor, Model } from 'sequelize-typescript';
import { User } from '../../models/user.model';
import { Order } from '../../models/order.model';
import { WebhookEvent } from '../../models/webhook-event.model';

// Central list of all models
export const ALL_MODELS: ModelCtor[] = [User, Order, WebhookEvent];

export const Models = {
  User,
  Order,
  WebhookEvent,
} as const;
export type Models = typeof Models;
