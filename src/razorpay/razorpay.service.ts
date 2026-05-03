import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PostgresService } from '../core/database/postgres.service';
import Razorpay from 'razorpay';
import { RazorpayOrder } from 'razorpay';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export interface CreateOrderDto {
  amount: number;
  productType: string;
  productId: string;
}

export interface VerifyPaymentDto {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  private readonly razorpay: Razorpay;
  private readonly keySecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly dbService: PostgresService,
  ) {
    const keyId = this.configService.getOrThrow<string>('RAZORPAY_KEY_ID');
    this.keySecret = this.configService.getOrThrow<string>(
      'RAZORPAY_KEY_SECRET',
    );

    this.razorpay = new Razorpay({
      key_id: keyId,
      key_secret: this.keySecret,
    });
  }

  async createOrder(
    userId: string,
    dto: CreateOrderDto,
  ): Promise<RazorpayOrder> {
    const { amount, productType, productId } = dto;

    const options = {
      amount: amount * 100, // paise
      currency: 'INR',
      receipt: `receipt_${uuidv4()}`,
    };

    const order = await this.razorpay.orders.create(options);

    try {
      await this.dbService.models.Order.create({
        userId,
        orderId: order.id,
        amount,
        currency: 'INR',
        status: 'pending',
        productType,
        productId,
      });
    } catch (err) {
      this.logger.error('Failed to save order to DB', err);
      throw new InternalServerErrorException('Failed to save order');
    }

    return order;
  }

  async verifyPayment(userId: string, dto: VerifyPaymentDto) {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = dto;

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.keySecret)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      this.logger.warn(`Invalid signature for order: ${razorpay_order_id}`);
      throw new BadRequestException('Invalid payment signature');
    }

    try {
      await this.dbService.models.Order.update(
        {
          paymentId: razorpay_payment_id,
          status: 'success',
        },
        {
          where: { orderId: razorpay_order_id },
        },
      );

      this.logger.log(
        `Payment verified for order: ${razorpay_order_id} (user: ${userId})`,
      );
      return { success: true };
    } catch (err) {
      this.logger.error('Failed to update order status', err);
      throw new InternalServerErrorException('Failed to update order');
    }
  }
}
