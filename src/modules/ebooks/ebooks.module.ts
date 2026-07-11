import { Module } from '@nestjs/common';
import { EbooksController } from './ebooks.controller';
import { ProductsModule } from '../products/products.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [ProductsModule, UsersModule],
  controllers: [EbooksController],
})
export class EbooksModule {}
