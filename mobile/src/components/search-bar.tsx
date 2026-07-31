import { Ionicons } from "@expo/vector-icons";
import { Pressable, TextInput, View } from "react-native";

import { dict } from "../i18n";
import { useTheme } from "../theme-context";
import { Txt } from "./ui";

/**
 * The search field, in two forms.
 *
 * `readOnly` renders it as a button that navigates to the search screen — used
 * on home, where a keyboard appearing under a scrolling page is a nuisance
 * rather than a shortcut.
 */
export function SearchBar({
  value,
  onChange,
  onSubmit,
  onPress,
  readOnly = false,
  autoFocus = false,
}: {
  value?: string;
  onChange?: (text: string) => void;
  onSubmit?: () => void;
  onPress?: () => void;
  readOnly?: boolean;
  autoFocus?: boolean;
}) {
  const { c, space, radius } = useTheme();
  const t = dict();

  const frame = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: space.sm,
    backgroundColor: c.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.line,
    paddingHorizontal: space.lg,
    height: 46,
  };

  if (readOnly) {
    return (
      <Pressable onPress={onPress} style={frame}>
        <Ionicons name="search" size={18} color={c.ink400} />
        <Txt variant="body" tone="faint">
          {t.searchPlaceholder}
        </Txt>
      </Pressable>
    );
  }

  return (
    <View style={frame}>
      <Ionicons name="search" size={18} color={c.ink400} />
      <TextInput
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onSubmit}
        placeholder={t.searchPlaceholder}
        placeholderTextColor={c.ink400}
        autoFocus={autoFocus}
        returnKeyType="search"
        // Without this the field lays out left-to-right and the caret starts on
        // the wrong side of an Arabic query.
        style={{
          flex: 1,
          color: c.ink,
          fontSize: 15,
          textAlign: "right",
          writingDirection: "rtl",
          // Android adds its own vertical padding that makes the pill oblong.
          paddingVertical: 0,
        }}
      />
      {!!value && (
        <Pressable onPress={() => onChange?.("")} hitSlop={8}>
          <Ionicons name="close-circle" size={18} color={c.ink400} />
        </Pressable>
      )}
    </View>
  );
}
