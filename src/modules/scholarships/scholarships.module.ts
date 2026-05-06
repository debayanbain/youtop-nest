import { Module } from '@nestjs/common';
import { ScholarshipsController } from './scholarships.controller';
import { RazorpayModule } from '../../razorpay/razorpay.module';

@Module({
  imports: [RazorpayModule],
  controllers: [ScholarshipsController],
})
export class ScholarshipsModule {}
