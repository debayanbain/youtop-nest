import { Module } from '@nestjs/common';
import { RazorpayController } from './razorpay.controller';
import { RazorpayService } from './razorpay.service';
import { ClerkAuthGuard } from '../auth/clerk.guard';
import { UsersModule } from '../modules/users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [RazorpayController],
  providers: [RazorpayService, ClerkAuthGuard],
  exports: [RazorpayService],
})
export class RazorpayModule {}
