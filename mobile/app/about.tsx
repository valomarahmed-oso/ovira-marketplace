import { InfoPage } from "../src/components/info-page";
import { dict } from "../src/i18n";

export default function AboutScreen() {
  const t = dict();
  return (
    <InfoPage
      title={t.pgAbout}
      subtitle={t.pgAboutSub}
      contentKey="about_content"
      fallback={t.pgAboutFallback}
    />
  );
}
