import { Linking, View } from "react-native";

import { parseRichText } from "../rich-text";
import { useTheme } from "../theme-context";
import { Txt } from "./ui";

/** Draws the blocks `parseRichText` produces. The parsing itself is tested. */
export function RichText({ html }: { html: string }) {
  const { c, space } = useTheme();
  const blocks = parseRichText(html);

  return (
    <View style={{ gap: space.md }}>
      {blocks.map((block, index) => {
        if (block.kind === "h") {
          return (
            <Txt key={index} variant="heading">
              {block.text}
            </Txt>
          );
        }

        if (block.kind === "li") {
          return (
            <View key={index} style={{ flexDirection: "row", gap: space.sm }}>
              <View
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: c.blue,
                  marginTop: 9,
                }}
              />
              <Txt variant="body" tone="muted" style={{ flex: 1 }}>
                {block.text}
              </Txt>
            </View>
          );
        }

        const href = block.href;
        return (
          <Txt
            key={index}
            variant="body"
            tone={href ? "blue" : "muted"}
            style={href ? { textDecorationLine: "underline" } : undefined}
            onPress={href ? () => void Linking.openURL(href).catch(() => {}) : undefined}
          >
            {block.text}
          </Txt>
        );
      })}
    </View>
  );
}
