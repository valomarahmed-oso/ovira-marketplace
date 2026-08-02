import { InfoPage } from "../src/components/info-page";
import { dict } from "../src/i18n";

export default function PrivacyScreen() {
  const t = dict();
  return (
    <InfoPage
      title={t.pgPrivacy}
      subtitle={t.pgPrivacySub}
      contentKey="privacy_content"
      fallback={t.pgPrivacyFallback}
    />
  );
}
