import { Controller, Get, UseGuards, Optional } from '@nestjs/common';
import { StrapiService } from '../../core/strapi/strapi.service';
import { RazorpayService } from '../../razorpay/razorpay.service';
import { UserId } from '../../auth/user-id.decorator';
import { Order } from '../../models/order.model';

@Controller('scholarships')
export class ScholarshipsController {
  constructor(
    private readonly strapiService: StrapiService,
    private readonly razorpayService: RazorpayService,
  ) {}

  @Get()
  async getScholarships(@Optional() @UserId() userId: string) {
    // 1. Fetch from Strapi
    const scholarships = await this.strapiService.get<any>(
      '/scholarships?populate=*',
    );

    // 2. If user is logged in, fetch their purchases (if scholarships are paid, usually they aren't but good to have)
    let userPurchases: Order[] = [];
    if (userId) {
      userPurchases = await this.razorpayService.getUserPurchases(userId);
    }

    // 3. Combine and clean
    return scholarships.map((s) => ({
      ...s,
      isOwned: userPurchases.some((p) => p.productId === s.id.toString()),
    }));
  }
}
