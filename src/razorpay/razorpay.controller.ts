import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { RazorpayService } from './razorpay.service';
import { ClerkAuthGuard } from '../auth/clerk.guard';
import { UserId } from '../auth/user-id.decorator';

class CreateOrderBody {
  amount: number;
  productType: string;
  productId: string;
}

class VerifyPaymentBody {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

@Controller('razorpay')
@UseGuards(ClerkAuthGuard)
export class RazorpayController {
  constructor(private readonly razorpayService: RazorpayService) {}

  /** POST /razorpay/order — Create a Razorpay order */
  @Post('order')
  async createOrder(
    @UserId() userId: string,
    @Body() body: CreateOrderBody,
  ) {
    return this.razorpayService.createOrder(userId, {
      amount: body.amount,
      productType: body.productType,
      productId: body.productId,
    });
  }

  /** POST /razorpay/verify — Verify payment signature & mark order as paid */
  @Post('verify')
  async verifyPayment(
    @UserId() userId: string,
    @Body() body: VerifyPaymentBody,
  ) {
    return this.razorpayService.verifyPayment(userId, {
      razorpay_order_id: body.razorpay_order_id,
      razorpay_payment_id: body.razorpay_payment_id,
      razorpay_signature: body.razorpay_signature,
    });
  }
}
