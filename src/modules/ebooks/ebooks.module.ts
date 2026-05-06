import { Module } from '@nestjs/common';
import { EbooksController } from './ebooks.controller';
import { RazorpayModule } from '../../razorpay/razorpay.module';

@Module({
  imports: [RazorpayModule],
  controllers: [EbooksController],
})
export class EbooksModule {}
