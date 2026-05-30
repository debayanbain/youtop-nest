import { Module } from '@nestjs/common';
import { EbooksController } from './ebooks.controller';
import { RazorpayModule } from '../../razorpay/razorpay.module';
import { StrapiModule } from '../../core/strapi/strapi.module';

@Module({
  imports: [RazorpayModule, StrapiModule],
  controllers: [EbooksController],
})
export class EbooksModule {}
