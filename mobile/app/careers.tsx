import { InfoPage } from "../src/components/info-page";
import { dict } from "../src/i18n";

export default function CareersScreen() {
  const t = dict();
  return (
    <InfoPage
      title={t.pgCareers}
      subtitle={t.pgCareersSub}
      contentKey="careers_content"
      fallback={t.pgCareersFallback}
    />
  );
}
