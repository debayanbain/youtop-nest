import { Module } from '@nestjs/common';
import { ScholarshipsController } from './scholarships.controller';
import { RazorpayModule } from '../../razorpay/razorpay.module';
import { StrapiModule } from '../../core/strapi/strapi.module';

@Module({
  imports: [RazorpayModule, StrapiModule],
  controllers: [ScholarshipsController],
})
export class ScholarshipsModule {}
