import Link from "next/link";
import { Compass, Home } from "lucide-react";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <div className="container-ovira flex justify-center py-20">
      <div className="card w-full max-w-md space-y-5 p-10 text-center">
        <Logo withWordmark={false} />
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-blue-50">
          <Compass className="h-7 w-7 text-blue-600" />
        </div>
        <h1 className="font-tech text-4xl font-medium text-ink">٤٠٤</h1>
        <p className="text-sm text-ink-400">
          الصفحة اللي بتدوّر عليها مش موجودة أو اتنقلت. يلا نرجّعك للرئيسية.
        </p>
        <div className="flex justify-center gap-2">
          <Link href="/" className="btn btn-primary inline-flex">
            <Home className="h-4 w-4" /> الرئيسية
          </Link>
          <Link href="/categories" className="btn btn-ghost inline-flex">
            تصفّح الأقسام
          </Link>
        </div>
      </div>
    </div>
  );
}
