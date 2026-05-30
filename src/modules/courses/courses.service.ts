import { Injectable, Logger } from '@nestjs/common';
import { StrapiService } from '../../core/strapi/strapi.service';
import { RazorpayService } from '../../razorpay/razorpay.service';
import { MediaUrlHelper } from '../../common/helpers/media-url.helper';

export interface CourseDto {
  id: string | number;
  title: string;
  slug: string;
  description?: string;
  price: number;
  discountedPrice?: number;
  thumbnail?: { url: string };
  isOwned: boolean;
  instructor?: { name: string; avatar?: { url: string } };
  tags?: string[];
}

@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);

  constructor(
    private readonly strapiService: StrapiService,
    private readonly razorpayService: RazorpayService,
  ) {}

  async getCourses(userId?: string): Promise<CourseDto[]> {
    const [rawCourses, userPurchases] = await Promise.all([
      this.strapiService.getCollection<any>(
        '/products?filters[type][$eq]=course&populate[thumbnail]=*&populate[instructor][populate]=avatar',
        60,
      ),
      userId ? this.razorpayService.getUserPurchases(userId) : Promise.resolve([]),
    ]);

    const purchasedIds = new Set(userPurchases.map((p) => p.productId));

    return rawCourses.map((c) => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
      description: c.description,
      price: c.price,
      discountedPrice: c.discountedPrice,
      thumbnail: c.thumbnail ? { url: MediaUrlHelper.resolve(c.thumbnail.url) } : undefined,
      isOwned: purchasedIds.has(c.id?.toString()),
      instructor: c.instructor
        ? {
            name: `${c.instructor.firstName || ''} ${c.instructor.lastName || ''}`.trim() || 'Instructor',
            avatar: c.instructor.avatar
              ? { url: MediaUrlHelper.resolve(c.instructor.avatar.url) }
              : undefined,
          }
        : undefined,
      tags: c.tags ?? [],
    }));
  }

  async getCourse(slug: string, userId?: string): Promise<CourseDto | null> {
    const courses = await this.strapiService.getCollection<any>(
      `/products?filters[slug][$eq]=${slug}&populate[thumbnail]=*&populate[instructor][populate]=avatar`,
      60,
    );
    if (!courses || courses.length === 0) {
      return null;
    }

    const purchases = userId
      ? await this.razorpayService.getUserPurchases(userId)
      : [];
    const purchasedIds = new Set(purchases.map((p) => p.productId));
    const c = courses[0];

    return {
      id: c.id,
      title: c.title,
      slug: c.slug,
      description: c.description,
      price: c.price,
      discountedPrice: c.discountedPrice,
      thumbnail: c.thumbnail ? { url: MediaUrlHelper.resolve(c.thumbnail.url) } : undefined,
      isOwned: purchasedIds.has(c.id?.toString()),
      instructor: c.instructor
        ? {
            name: `${c.instructor.firstName || ''} ${c.instructor.lastName || ''}`.trim() || 'Instructor',
            avatar: c.instructor.avatar
              ? { url: MediaUrlHelper.resolve(c.instructor.avatar.url) }
              : undefined,
          }
        : undefined,
      tags: c.tags ?? [],
    };
  }
}
