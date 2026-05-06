import { Controller, Get, UseGuards, Optional } from '@nestjs/common';
import { StrapiService } from '../../core/strapi/strapi.service';
import { RazorpayService } from '../../razorpay/razorpay.service';
import { Order } from '../../models/order.model';
import { ClerkAuthGuard } from '../../auth/clerk.guard';
import { UserId } from '../../auth/user-id.decorator';

@Controller('ebooks')
export class EbooksController {
  constructor(
    private readonly strapiService: StrapiService,
    private readonly razorpayService: RazorpayService,
  ) {}

  @Get()
  async getEbooks(@Optional() @UserId() userId: string) {
    // 1. Fetch from Strapi
    const ebooks = await this.strapiService.get<any>('/ebooks?populate=*');

    // 2. If user is logged in, fetch their purchases
    let userPurchases: Order[] = [];
    if (userId) {
      userPurchases = await this.razorpayService.getUserPurchases(userId);
    }

    // 3. Combine and clean
    return ebooks.map((book) => ({
      ...book,
      isOwned: userPurchases.some((p) => p.productId === book.id.toString()),
    }));
  }
}
