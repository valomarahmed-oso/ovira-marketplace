/** Renders operator-authored rich content (from the Site Content CMS). The HTML
 * is trusted operator input; basic element styling keeps it on-brand. */
export function CmsRichText({ html }: { html: string }) {
  return (
    <div
      className="space-y-4 text-sm leading-7 text-ink-600 [&_a]:text-blue-600 [&_a:hover]:underline [&_h2]:pt-2 [&_h2]:text-lg [&_h2]:font-medium [&_h2]:text-ink [&_h3]:font-medium [&_h3]:text-ink [&_li]:my-1 [&_ol]:list-decimal [&_ol]:ps-6 [&_strong]:text-ink [&_ul]:list-disc [&_ul]:ps-6"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
