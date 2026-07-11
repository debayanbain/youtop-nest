import { Module } from '@nestjs/common';
import { NotesController } from './notes.controller';
import { ProductsModule } from '../products/products.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [ProductsModule, UsersModule],
  controllers: [NotesController],
})
export class NotesModule {}
