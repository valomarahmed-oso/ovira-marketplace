import { cn, formatPrice } from "@/lib/utils";

const ORDERS = [
  { id: "OVR-7K2M9X", customer: "أحمد سمير", items: 2, total: 4149, status: "new", date: "اليوم" },
  { id: "OVR-3J8P1Q", customer: "منى خالد", items: 1, total: 1650, status: "shipped", date: "أمس" },
  { id: "OVR-9XR4T2", customer: "كريم فؤاد", items: 3, total: 5230, status: "delivered", date: "قبل ٣ أيام" },
  { id: "OVR-5N6B0L", customer: "سارة علي", items: 1, total: 690, status: "delivered", date: "قبل أسبوع" },
];

const STATUS: Record<string, { label: string; style: string }> = {
  new: { label: "جديد", style: "bg-blue-50 text-blue-600" },
  shipped: { label: "تم الشحن", style: "bg-[#fdf2dd] text-[#854f0b]" },
  delivered: { label: "تم التسليم", style: "bg-[#e7f8f1] text-mint" },
};

export default function VendorOrdersPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-medium text-ink">الطلبات</h1>
      <div className="card overflow-hidden">
        <div className="hidden grid-cols-[1.2fr_1.5fr_0.8fr_1fr_1fr] gap-3 border-b border-line p-4 text-xs text-ink-400 md:grid">
          <span>رقم الطلب</span>
          <span>العميل</span>
          <span>المنتجات</span>
          <span>الإجمالي</span>
          <span>الحالة</span>
        </div>
        <div className="divide-y divide-line">
          {ORDERS.map((o) => (
            <div key={o.id} className="grid grid-cols-2 gap-3 p-4 text-sm md:grid-cols-[1.2fr_1.5fr_0.8fr_1fr_1fr] md:items-center">
              <span className="font-tech font-medium text-ink">{o.id}</span>
              <span className="text-ink-600">{o.customer}</span>
              <span className="text-ink-400">{o.items} منتج</span>
              <span className="font-tech text-ink">{formatPrice(o.total)}</span>
              <span>
                <span className={cn("rounded-full px-2 py-0.5 text-xs", STATUS[o.status].style)}>
                  {STATUS[o.status].label}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
