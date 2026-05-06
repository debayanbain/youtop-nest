import { Module } from '@nestjs/common';
import { NotesController } from './notes.controller';
import { RazorpayModule } from '../../razorpay/razorpay.module';

@Module({
  imports: [RazorpayModule],
  controllers: [NotesController],
})
export class NotesModule {}
