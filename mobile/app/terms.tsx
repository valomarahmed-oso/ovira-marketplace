import { InfoPage } from "../src/components/info-page";
import { dict } from "../src/i18n";

export default function TermsScreen() {
  const t = dict();
  return (
    <InfoPage
      title={t.pgTerms}
      subtitle={t.pgTermsSub}
      contentKey="terms_content"
      fallback={t.pgTermsFallback}
    />
  );
}
