import {
  Controller,
  Get,
  Param,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { ProductsService } from '../products/products.service';
import { UserId } from '../../auth/user-id.decorator';
import { ClerkOptionalAuthGuard } from '../../auth/optional-auth.guard';

@Controller({ path: 'notes', version: '1' })
export class NotesController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @UseGuards(ClerkOptionalAuthGuard)
  async getNotes(@UserId() userId: string) {
    return this.productsService.getByType('note', userId);
  }

  @Get(':id')
  @UseGuards(ClerkOptionalAuthGuard)
  async getNote(@Param('id') id: string, @UserId() userId: string) {
    const note = await this.productsService.getById(id, 'note', userId);
    if (!note) {
      throw new NotFoundException('Note not found');
    }
    return note;
  }
}
