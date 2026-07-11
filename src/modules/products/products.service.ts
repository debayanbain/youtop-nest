import { Injectable } from '@nestjs/common';
import { StrapiService } from '../../core/strapi/strapi.service';
import { RazorpayService } from '../../razorpay/razorpay.service';
import { MediaUrlHelper } from '../../common/helpers/media-url.helper';

/**
 * A sellable item from the single Strapi `products` collection
 * (REST id `products-manage`), differentiated by `type`.
 */
export interface ProductDto {
  id: string | number;
  title: string;
  slug: string;
  type: string;
  class: string;
  subject: string;
  author?: string;
  description?: string;
  price: number;
  originalPrice?: number;
  discountedPrice: number;
  tag?: string;
  imageLink: string;
  thumbnail: { url: string };
  isBestSeller: boolean;
  isFeatured: boolean;
  isOwned: boolean;
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly strapiService: StrapiService,
    private readonly razorpayService: RazorpayService,
  ) {}

  /** Set of Strapi product ids the user has a successful order for. */
  private async ownedIds(userId?: string): Promise<Set<string>> {
    if (!userId) return new Set();
    const purchases = await this.razorpayService.getUserPurchases(userId);
    return new Set(purchases.map((p) => p.productId));
  }

  private map(p: any, owned: Set<string>): ProductDto {
    // Never empty: falls back to the placeholder so the frontend always has a
    // valid `src` for `next/image`.
    const thumbUrl = MediaUrlHelper.image(p.thumbnail?.url);

    return {
      id: p.id,
      title: p.title,
      slug: p.slug,
      type: p.type,
      // class is a Strapi integer; the UI treats it as a string ("12").
      class: p.class != null ? String(p.class) : '',
      subject: p.subject ?? '',
      author: p.author_name ?? undefined,
      description: p.short_description ?? undefined,
      // price/old_price are Strapi bigintegers → serialized as strings.
      price: Number(p.price ?? 0),
      originalPrice: p.old_price != null ? Number(p.old_price) : undefined,
      discountedPrice: Number(p.price ?? 0),
      tag: p.badge ?? undefined,
      imageLink: thumbUrl,
      thumbnail: { url: thumbUrl },
      isBestSeller: !!p.is_best_seller,
      isFeatured: !!p.is_featured,
      isOwned: owned.has(String(p.id)),
    };
  }

  async getByType(type: string, userId?: string): Promise<ProductDto[]> {
    const [products, owned] = await Promise.all([
      this.strapiService.getCollection<any>(
        `/products-manage?filters[type][$eq]=${type}&populate=thumbnail&sort=sort_order:asc`,
        60,
      ),
      this.ownedIds(userId),
    ]);
    return products.map((p) => this.map(p, owned));
  }

  async getBySlug(slug: string, userId?: string): Promise<ProductDto | null> {
    const [products, owned] = await Promise.all([
      this.strapiService.getCollection<any>(
        `/products-manage?filters[slug][$eq]=${slug}&populate=thumbnail`,
        60,
      ),
      this.ownedIds(userId),
    ]);
    if (!products.length) return null;
    return this.map(products[0], owned);
  }

  /**
   * Fetch a single product by its Strapi id, optionally scoped to a `type` so
   * e.g. `/notes/:id` can't resolve an ebook. Returns null when not found.
   */
  async getById(
    id: string | number,
    type?: string,
    userId?: string,
  ): Promise<ProductDto | null> {
    const typeFilter = type ? `&filters[type][$eq]=${type}` : '';
    const [products, owned] = await Promise.all([
      this.strapiService.getCollection<any>(
        `/products-manage?filters[id][$eq]=${id}${typeFilter}&populate=thumbnail`,
        60,
      ),
      this.ownedIds(userId),
    ]);
    if (!products.length) return null;
    return this.map(products[0], owned);
  }
}
