import { Controller, Get, UseGuards, Optional } from '@nestjs/common';
import { StrapiService } from '../../core/strapi/strapi.service';
import { RazorpayService } from '../../razorpay/razorpay.service';
import { UserId } from '../../auth/user-id.decorator';
import { Order } from '../../models/order.model';

@Controller('notes')
export class NotesController {
  constructor(
    private readonly strapiService: StrapiService,
    private readonly razorpayService: RazorpayService,
  ) {}

  @Get()
  async getNotes(@Optional() @UserId() userId: string) {
    // 1. Fetch from Strapi
    const notes = await this.strapiService.get<any>('/notes?populate=*');

    // 2. If user is logged in, fetch their purchases
    let userPurchases: Order[] = [];
    if (userId) {
      userPurchases = await this.razorpayService.getUserPurchases(userId);
    }

    // 3. Combine and clean
    return notes.map((note) => ({
      ...note,
      isOwned: userPurchases.some((p) => p.productId === note.id.toString()),
    }));
  }
}
