import { Module } from '@nestjs/common';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { StrapiModule } from '../../core/strapi/strapi.module';
import { RazorpayModule } from '../../razorpay/razorpay.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [StrapiModule, RazorpayModule, UsersModule],
  controllers: [CoursesController],
  providers: [CoursesService],
  exports: [CoursesService],
})
export class CoursesModule {}
