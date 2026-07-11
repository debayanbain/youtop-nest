import { Injectable } from '@nestjs/common';
import { ProductsService, ProductDto } from '../products/products.service';

@Injectable()
export class CoursesService {
  constructor(private readonly productsService: ProductsService) {}

  getCourses(userId?: string): Promise<ProductDto[]> {
    return this.productsService.getByType('course', userId);
  }

  getCourse(slug: string, userId?: string): Promise<ProductDto | null> {
    return this.productsService.getBySlug(slug, userId);
  }
}
