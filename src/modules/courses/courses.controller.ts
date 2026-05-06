import { Controller, Get, UseGuards, Optional } from '@nestjs/common';
import { StrapiService } from '../../core/strapi/strapi.service';
import { RazorpayService } from '../../razorpay/razorpay.service';
import { UserId } from '../../auth/user-id.decorator';
import { Order } from '../../models/order.model';

@Controller('courses')
export class CoursesController {
  constructor(
    private readonly strapiService: StrapiService,
    private readonly razorpayService: RazorpayService,
  ) {}

  @Get()
  async getCourses(@Optional() @UserId() userId: string) {
    // 1. Fetch from Strapi
    const courses = await this.strapiService.get<any>('/courses?populate=*');

    // 2. If user is logged in, fetch their purchases
    let userPurchases: Order[] = [];
    if (userId) {
      userPurchases = await this.razorpayService.getUserPurchases(userId);
    }

    // 3. Combine and clean
    return courses.map((course) => ({
      ...course,
      isOwned: userPurchases.some((p) => p.productId === course.id.toString()),
    }));
  }
}
