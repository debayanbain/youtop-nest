import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { StrapiModule } from '../../core/strapi/strapi.module';
import { RazorpayModule } from '../../razorpay/razorpay.module';

@Module({
  imports: [StrapiModule, RazorpayModule],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
