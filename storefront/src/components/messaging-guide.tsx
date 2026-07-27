"use client";

import { FileText, Type } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

/** What each channel actually is, in the operator's language.
 *
 *  The question behind every one of these rows is the same: *who is the message
 *  from?* A hub sender is not an account you top up — it's a WhatsApp number
 *  someone scanned, a bot someone created, a mailbox, a SIM. Answering that up
 *  front is what stops "why does it say failed?" from becoming a support thread.
 */
type Row = {
  id: string;
  label: [string, string];
  from: [string, string];
  needs: [string, string];
  cost: [string, string];
  files: boolean;
};

const ROWS: Row[] = [
  {
    id: "whatsapp_waha",
    label: ["واتساب ذاتي (WAHA)", "WhatsApp (self-hosted)"],
    from: [
      "رقم واتساب بتاعك، بتربطه مرة واحدة بمسح كود QR",
      "Your own WhatsApp number, linked once by scanning a QR code",
    ],
    needs: [
      "حاوية WAHA على السيرفر (استوردها من فوق) وبعدين امسح الكود",
      "The WAHA container on this server (import it above), then scan the code",
    ],
    cost: ["مجاني — بدون تكلفة لكل رسالة", "Free — no per-message charge"],
    files: true,
  },
  {
    id: "whatsapp_official",
    label: ["واتساب الرسمي (Meta)", "WhatsApp (official / Meta)"],
    from: [
      "رقم مسجّل في Meta Business — مش رقم على موبايل",
      "A number registered in Meta Business, not one on a handset",
    ],
    needs: [
      "حساب Meta Business ورقم موثّق وToken، وقوالب معتمدة خارج نافذة الـ24 ساعة",
      "A Meta Business account, a verified number and a token; approved templates outside the 24h window",
    ],
    cost: ["حد مجاني ثم مدفوع لكل محادثة", "Free tier, then paid per conversation"],
    files: true,
  },
  {
    id: "telegram",
    label: ["تليجرام", "Telegram"],
    from: [
      "بوت بتنشئه من @BotFather — الراسل هو البوت مش رقمك",
      "A bot you create with @BotFather — the sender is the bot, not a phone number",
    ],
    needs: [
      "توكن البوت، والعميل لازم يضغط Start مرة واحدة (الإرسال بمعرّف المحادثة)",
      "The bot token, and the customer must press Start once (you send to a chat id)",
    ],
    cost: ["مجاني بالكامل", "Completely free"],
    files: true,
  },
  {
    id: "email",
    label: ["البريد (SMTP)", "Email (SMTP)"],
    from: ["عنوان البريد المسجّل في الحساب", "The From address on the account"],
    needs: [
      "سيرفر SMTP ويوزر وكلمة مرور — أو استورد بريد السيرفر من فوق",
      "An SMTP server with credentials — or import the server's account above",
    ],
    cost: ["حسب مزوّد البريد", "Whatever your mail provider charges"],
    files: true,
  },
  {
    id: "sms_http",
    label: ["SMS (بوابة)", "SMS (gateway)"],
    from: [
      "شريحتك عن طريق تطبيق بوابة أندرويد، أو Sender ID من مزوّدك",
      "Your own SIM via an Android gateway app, or your provider's sender id",
    ],
    needs: ["رابط بوابة يستقبل رقم ونص", "A gateway URL that takes a recipient and a text"],
    cost: ["سعر الرسالة من شركة الاتصالات", "The carrier's SMS price"],
    files: false,
  },
  {
    id: "sms_twilio",
    label: ["SMS (Twilio)", "SMS (Twilio)"],
    from: ["رقم بتشتريه من Twilio", "A number you buy inside Twilio"],
    needs: ["Account SID ورمز مصادقة ورقم للإرسال", "Account SID, auth token and a sending number"],
    cost: ["مدفوع لكل رسالة", "Paid per message"],
    files: false,
  },
  {
    id: "wa_link",
    label: ["رابط واتساب (wa.me)", "WhatsApp link (wa.me)"],
    from: [
      "حساب الواتساب المفتوح على جهاز الموظف — الرسالة بتتبعت بإيده",
      "Whatever WhatsApp account is open on that device — sent by hand",
    ],
    needs: ["لا شيء — بيفتح واتساب والنص جاهز", "Nothing — WhatsApp opens with the text ready"],
    cost: ["مجاني", "Free"],
    files: false,
  },
];

export function MessagingGuide() {
  const { t, locale } = useI18n();
  const i = locale === "en" ? 1 : 0;

  return (
    <section className="space-y-3">
      <h3 className="font-medium text-ink">{t.mhGuideTitle}</h3>
      <p className="text-xs leading-relaxed text-ink-400">{t.mhGuideIntro}</p>

      <div className="space-y-2">
        {ROWS.map((r) => (
          <div key={r.id} className="card space-y-1.5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-ink">{r.label[i]}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-line/40 px-2.5 py-1 text-[11px] text-ink-400">
                {r.files ? (
                  <>
                    <FileText className="h-3.5 w-3.5" /> PDF
                  </>
                ) : (
                  <>
                    <Type className="h-3.5 w-3.5" /> {t.mhGuideTextOnly}
                  </>
                )}
              </span>
            </div>
            <Line label={t.mhGuideSendsFrom} value={r.from[i]} />
            <Line label={t.mhGuideNeeds} value={r.needs[i]} />
            <Line label={t.mhGuideCost} value={r.cost[i]} />
          </div>
        ))}
      </div>
    </section>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-xs leading-relaxed text-ink-400">
      <span className="font-medium text-ink">{label}:</span> {value}
    </p>
  );
}
