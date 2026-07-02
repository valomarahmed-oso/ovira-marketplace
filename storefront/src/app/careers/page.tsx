import type { Metadata } from "next";
import { InfoPage, InfoSection } from "@/components/info-page";

export const metadata: Metadata = { title: "الوظائف | أوفيرا" };

export default function CareersPage() {
  return (
    <InfoPage title="الوظائف" subtitle="انضم لفريق بيبني تجربة التسوّق الجاية في مصر.">
      <p>
        بنكبر بسرعة وبندوّر دايمًا على ناس شاطرة بتحب المنتج والتفاصيل — هندسة، تشغيل،
        خدمة عملاء، ونمو.
      </p>
      <InfoSection heading="مفيش وظائف معلنة حاليًا">
        <p>
          مفيش شواغر مفتوحة في الوقت الحالي، بس لو شايف إنك إضافة حقيقية للفريق ابعتلنا
          سيرتك الذاتية على{" "}
          <a href="mailto:jobs@ovira.cloud" className="text-blue-600 hover:underline">
            jobs@ovira.cloud
          </a>{" "}
          وهنرجع لك أول ما يفتح شاغر مناسب.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
