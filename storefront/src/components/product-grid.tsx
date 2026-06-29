import type { Product } from "@/lib/api";
import { ProductCard } from "@/components/product-card";

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.name} p={p} />
      ))}
    </div>
  );
}
