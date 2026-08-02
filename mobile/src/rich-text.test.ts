import assert from "node:assert/strict";
import { test } from "node:test";

import { parseRichText } from "./rich-text.ts";

test("paragraphs and headings keep their order and kind", () => {
  const blocks = parseRichText("<h2>ليه أوفيرا؟</h2><p>بائعون مراجَعون.</p>");
  assert.deepEqual(
    blocks.map((b) => b.kind),
    ["h", "p"],
  );
  assert.equal(blocks[0]?.text, "ليه أوفيرا؟");
});

test("list items become their own blocks", () => {
  const blocks = parseRichText("<ul><li>دفع آمن</li><li>إرجاع سهل</li></ul>");
  assert.equal(blocks.length, 2);
  assert.ok(blocks.every((b) => b.kind === "li"));
});

test("inline markup is flattened, not dropped", () => {
  // The whole point: a bold word inside a sentence must not remove the word.
  const [block] = parseRichText("<p>شحن <strong>سريع</strong> لكل المحافظات</p>");
  assert.equal(block?.text, "شحن سريع لكل المحافظات");
});

test("a link's href is carried so the paragraph can be tapped", () => {
  const [block] = parseRichText('<p>راسلنا على <a href="mailto:s@ovira.cloud">الدعم</a></p>');
  assert.equal(block?.href, "mailto:s@ovira.cloud");
  assert.equal(block?.text, "راسلنا على الدعم");
});

test("entities are decoded", () => {
  const [block] = parseRichText("<p>&quot;أوفيرا&quot; &amp; شركاؤها</p>");
  assert.equal(block?.text, '"أوفيرا" & شركاؤها');
});

test("a <br> is a line break, not a lost space", () => {
  const blocks = parseRichText("<p>سطر<br/>تاني</p>");
  assert.equal(blocks[0]?.text, "سطر\nتاني");
});

test("plain text with no tags still renders", () => {
  // An operator who typed a sentence into the field, with no editor markup.
  const blocks = parseRichText("مرحبًا بك في أوفيرا");
  assert.deepEqual(blocks, [{ kind: "p", text: "مرحبًا بك في أوفيرا" }]);
});

test("empty and whitespace-only content produce nothing to draw", () => {
  assert.deepEqual(parseRichText(""), []);
  assert.deepEqual(parseRichText("<p></p><p>   </p>"), []);
});

test("unknown markup degrades to its words rather than vanishing", () => {
  const blocks = parseRichText("<table><tr><td>شحن مجاني</td></tr></table>");
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0]?.text, "شحن مجاني");
});
