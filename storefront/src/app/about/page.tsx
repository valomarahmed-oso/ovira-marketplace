import type { Metadata } from "next";
import { InfoPage, InfoSection } from "@/components/info-page";
import { CmsRichText } from "@/components/cms-rich-text";
import { getSiteContent, localizeSiteContent } from "@/lib/api";
import { getDict } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export const metadata: Metadata = { title: "من نحن | أوفيرا" };

export default async function AboutPage() {
  const [locale, raw] = await Promise.all([getLocale(), getSiteContent()]);
  const content = localizeSiteContent(raw, locale);
  const t = getDict(locale);
  return (
    <InfoPage title={t.pgAboutTitle} subtitle={t.pgAboutSub}>
      {content.about_content ? (
        <CmsRichText html={content.about_content} />
      ) : (
        <>
      <p>
        أوفيرا ماركت بليس مصري متعدد البائعين، بيجمع آلاف المنتجات من بائعين موثوقين في مكان
        واحد: إلكترونيات، موضة، مستلزمات المنزل، الجمال، وأكتر. هدفنا تجربة تسوّق سهلة وآمنة
        بأسعار تنافسية وشحن سريع لكل محافظات مصر.
      </p>
      <InfoSection heading="ليه أوفيرا؟">
        <p>— بائعون مراجَعون ومعتمدون قبل ما ينشروا منتجاتهم.</p>
        <p>— دفع آمن: كاش عند الاستلام أو دفع إلكتروني عبر بوابات معتمدة.</p>
        <p>— إرجاع سهل خلال 14 يوم وخدمة عملاء بتساعدك فعلاً.</p>
      </InfoSection>
      <InfoSection heading="للبائعين">
        <p>
          لو عندك منتجات وعايز توصل لعملاء أكتر، افتح متجرك على أوفيرا في دقائق: سجّل من صفحة
          «ابدأ البيع»، وبعد اعتماد متجرك ترفع منتجاتك وتتابع مبيعاتك ومستحقاتك من لوحة تحكم
          خاصة بيك.
        </p>
      </InfoSection>
      <InfoSection heading="تواصل معنا">
        <p>
          لأي استفسار أو شكوى راسلنا على{" "}
          <a href="mailto:support@ovira.cloud" className="text-blue-600 hover:underline">
            support@ovira.cloud
          </a>
          .
        </p>
      </InfoSection>
        </>
      )}
    </InfoPage>
  );
}
