import type { ProductCard } from "@ovira/core";

/**
 * Reduce a product to the fields a tile renders.
 *
 * The product page hands over a full `Product` — description, media, variants,
 * every Frappe audit column. The wishlist and the comparison tray only ever
 * render a card, they both persist to device storage, and the wishlist is
 * mirrored to a server that caps the blob at 1 MB across 200 items. Saving
 * whole documents is how a shopper with a long list starts having their
 * wishlist silently refused.
 */
export function toCard(p: ProductCard): ProductCard {
  return {
    name: p.name,
    title: p.title,
    slug: p.slug,
    price: p.price,
    compare_at_price: p.compare_at_price ?? null,
    currency: p.currency,
    vendor: p.vendor,
    vendor_name: p.vendor_name ?? null,
    category: p.category ?? null,
    brand: p.brand ?? null,
    stock_qty: p.stock_qty,
    rating: p.rating,
    review_count: p.review_count,
    has_variants: p.has_variants,
    image: p.image ?? null,
  };
}
