import Link from "next/link";
import { CheckCircle2, Package, XCircle } from "lucide-react";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; status?: string }>;
}) {
  const { order, status } = await searchParams;

  if (status === "failed") {
    return (
      <div className="container-ovira py-16">
        <div className="card mx-auto max-w-md space-y-4 p-10 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-coral-50">
            <XCircle className="h-8 w-8 text-coral" />
          </div>
          <h1 className="text-xl font-medium text-ink">لم تتم عملية الدفع</h1>
          <p className="text-sm text-ink-400">حصلت مشكلة في الدفع لطلب {order}. حاول تاني.</p>
          <div className="flex justify-center gap-2 pt-2">
            <Link href="/cart" className="btn btn-primary">العودة للسلة</Link>
            <Link href="/" className="btn btn-ghost">المتجر</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-ovira py-16">
      <div className="card mx-auto max-w-md space-y-4 p-10 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#e7f8f1]">
          <CheckCircle2 className="h-8 w-8 text-mint" />
        </div>
        <h1 className="text-xl font-medium text-ink">تم استلام طلبك!</h1>
        <div>
          <p className="text-sm text-ink-400">رقم الطلب</p>
          <p className="font-tech text-lg font-medium text-ink">{order ?? "OVR-XXXXXX"}</p>
        </div>
        <p className="text-sm text-ink-600">هنبعتلك تأكيد وتفاصيل التتبّع قريبًا على رقمك.</p>
        <div className="flex justify-center gap-2 pt-2">
          <Link href="/account/orders" className="btn btn-ghost">
            <Package className="h-4 w-4" /> تتبّع الطلب
          </Link>
          <Link href="/" className="btn btn-primary">
            متابعة التسوّق
          </Link>
        </div>
      </div>
    </div>
  );
}
