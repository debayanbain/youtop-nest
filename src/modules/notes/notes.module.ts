import { Module } from '@nestjs/common';
import { NotesController } from './notes.controller';
import { RazorpayModule } from '../../razorpay/razorpay.module';
import { StrapiModule } from '../../core/strapi/strapi.module';

@Module({
  imports: [RazorpayModule, StrapiModule],
  controllers: [NotesController],
})
export class NotesModule {}
