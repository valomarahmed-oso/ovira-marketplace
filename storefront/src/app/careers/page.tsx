import type { Metadata } from "next";
import { InfoPage, InfoSection } from "@/components/info-page";
import { CmsRichText } from "@/components/cms-rich-text";
import { getSiteContent, localizeSiteContent } from "@/lib/api";
import { getDict } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export const metadata: Metadata = { title: "الوظائف | أوفيرا" };

export default async function CareersPage() {
  const [locale, raw] = await Promise.all([getLocale(), getSiteContent()]);
  const content = localizeSiteContent(raw, locale);
  const t = getDict(locale);
  return (
    <InfoPage title={t.pgCareersTitle} subtitle={t.pgCareersSub}>
      {content.careers_content ? (
        <CmsRichText html={content.careers_content} />
      ) : (
        <>
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
        </>
      )}
    </InfoPage>
  );
}
