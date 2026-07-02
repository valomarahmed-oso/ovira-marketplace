import type { Metadata } from "next";
import { InfoPage, InfoSection } from "@/components/info-page";

export const metadata: Metadata = { title: "سياسة الخصوصية | أوفيرا" };

export default function PrivacyPage() {
  return (
    <InfoPage title="سياسة الخصوصية" subtitle="آخر تحديث: يوليو 2026">
      <p>
        خصوصيتك أولوية. السياسة دي بتوضح إيه البيانات اللي بنجمعها، بنستخدمها في إيه،
        وحقوقك عليها.
      </p>
      <InfoSection heading="البيانات اللي بنجمعها">
        <p>
          — بيانات الحساب: الاسم، البريد الإلكتروني، رقم الموبايل.
          <br />— بيانات الطلبات: العناوين، المنتجات، وسيلة الدفع (من غير تخزين أرقام
          البطاقات — الدفع بيتم عبر بوابات دفع معتمدة).
          <br />— بيانات تقنية: نوع الجهاز والمتصفح لتحسين الأداء والأمان.
        </p>
      </InfoSection>
      <InfoSection heading="بنستخدمها ليه">
        <p>
          تنفيذ الطلبات والشحن، خدمة العملاء، تأمين الحسابات ومنع الاحتيال، وتحسين تجربة
          التسوّق. مش بنبيع بياناتك لأي طرف ثالث.
        </p>
      </InfoSection>
      <InfoSection heading="المشاركة مع الغير">
        <p>
          بنشارك الحد الأدنى الضروري فقط: اسمك وعنوانك ورقمك مع شركة الشحن لتوصيل طلبك،
          وبيانات المعاملة مع بوابة الدفع لإتمامها. البائع بيشوف تفاصيل طلبه من غير
          بيانات الدفع.
        </p>
      </InfoSection>
      <InfoSection heading="حقوقك">
        <p>
          ليك الحق في الاطلاع على بياناتك أو تصحيحها أو طلب حذف حسابك في أي وقت عبر{" "}
          <a href="mailto:privacy@ovira.cloud" className="text-blue-600 hover:underline">
            privacy@ovira.cloud
          </a>
          .
        </p>
      </InfoSection>
      <InfoSection heading="ملفات تعريف الارتباط (Cookies)">
        <p>
          بنستخدم كوكيز ضرورية لتسجيل الدخول وسلة التسوّق وتفضيلات اللغة والمظهر. تقدر
          تمسحها من إعدادات متصفحك، مع العلم إن ده هيسجّل خروجك.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
