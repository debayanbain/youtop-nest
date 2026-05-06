import { Module } from '@nestjs/common';
import { CoursesController } from './courses.controller';
import { RazorpayModule } from '../../razorpay/razorpay.module';

@Module({
  imports: [RazorpayModule],
  controllers: [CoursesController],
})
export class CoursesModule {}
