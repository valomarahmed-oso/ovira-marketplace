import Link from "next/link";
import { WifiOff } from "lucide-react";
import { OviraBars } from "@/components/ovira-bars";

export default function OfflinePage() {
  return (
    <div className="container-ovira py-20">
      <div className="card mx-auto max-w-md space-y-4 p-10 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-blue-50">
          <WifiOff className="h-7 w-7 text-blue-600" />
        </div>
        <div className="flex justify-center">
          <OviraBars />
        </div>
        <h1 className="text-xl font-medium text-ink">إنت غير متصل بالإنترنت</h1>
        <p className="text-sm text-ink-400">
          تأكد من اتصالك وحاول تاني. الصفحات اللي زرتها قبل كده تقدر تتصفّحها بدون نت.
        </p>
        <Link href="/" className="btn btn-primary inline-flex">
          إعادة المحاولة
        </Link>
      </div>
    </div>
  );
}
