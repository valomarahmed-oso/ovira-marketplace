import { VendorSidebar } from "@/components/vendor-sidebar";

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container-ovira py-6">
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <VendorSidebar />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
