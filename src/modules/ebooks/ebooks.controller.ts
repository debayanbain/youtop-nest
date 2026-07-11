import { Controller, Get, UseGuards } from '@nestjs/common';
import { ProductsService } from '../products/products.service';
import { UserId } from '../../auth/user-id.decorator';
import { ClerkOptionalAuthGuard } from '../../auth/optional-auth.guard';

@Controller({ path: 'ebooks', version: '1' })
export class EbooksController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @UseGuards(ClerkOptionalAuthGuard)
  async getEbooks(@UserId() userId: string) {
    return this.productsService.getByType('ebook', userId);
  }
}
