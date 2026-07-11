import { Module } from '@nestjs/common';
import { GlobalController } from './global.controller';
import { GlobalService } from './global.service';
import { StrapiModule } from '../../core/strapi/strapi.module';

@Module({
  imports: [StrapiModule],
  controllers: [GlobalController],
  providers: [GlobalService],
})
export class GlobalModule {}
