import { Ionicons } from "@expo/vector-icons";
import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useTheme } from "../theme-context";
import { Row, Txt, VStack } from "./ui";

/**
 * A labelled field.
 *
 * `textAlign: right` is set explicitly rather than left to the framework:
 * during development the app runs in Expo Go without the native RTL flag, and a
 * caret that starts on the wrong side of an Arabic name is the first thing a
 * shopper notices about a form.
 */
export function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  secure = false,
  autoCapitalize = "none",
  multiline = false,
  error,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  secure?: boolean;
  autoCapitalize?: "none" | "words" | "sentences";
  multiline?: boolean;
  error?: string;
}) {
  const { c, space, radius } = useTheme();
  const [hidden, setHidden] = useState(secure);

  return (
    <VStack gap="xs">
      <Txt variant="label" tone="muted">
        {label}
      </Txt>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: error ? c.coral : c.line,
          borderRadius: radius.md,
          paddingHorizontal: space.md,
          minHeight: multiline ? 84 : 46,
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={c.ink400}
          keyboardType={keyboardType}
          secureTextEntry={hidden}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          multiline={multiline}
          style={{
            flex: 1,
            color: c.ink,
            fontSize: 15,
            textAlign: "right",
            writingDirection: "rtl",
            paddingVertical: multiline ? space.md : 0,
            textAlignVertical: multiline ? "top" : "center",
          }}
        />
        {secure && (
          <Pressable onPress={() => setHidden((v) => !v)} hitSlop={8}>
            <Ionicons name={hidden ? "eye-outline" : "eye-off-outline"} size={18} color={c.ink400} />
          </Pressable>
        )}
      </View>
      {!!error && (
        <Txt variant="caption" tone="coral">
          {error}
        </Txt>
      )}
    </VStack>
  );
}

/** A row of mutually exclusive choices — governorate, payment method, courier. */
export function ChoiceRow<T extends string>({
  options,
  value,
  onChange,
  wrap = true,
}: {
  options: Array<{ value: T; label: string }>;
  value: T | null;
  onChange: (value: T) => void;
  wrap?: boolean;
}) {
  const { c, space, radius } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: wrap ? "wrap" : "nowrap",
        gap: space.sm,
      }}
    >
      {options.map((option) => {
        const on = value === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={{
              borderWidth: 1,
              borderColor: on ? c.blue : c.line,
              backgroundColor: on ? c.blue050 : c.surface,
              borderRadius: radius.pill,
              paddingHorizontal: space.lg,
              paddingVertical: space.sm,
            }}
          >
            <Txt variant="caption" tone={on ? "blue" : "muted"}>
              {option.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A pickable card — a saved address, a delivery method, a payment option. */
export function OptionCard({
  selected,
  onPress,
  disabled = false,
  children,
  style,
}: {
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { c, space, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: space.md,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: selected ? c.blue : c.line,
          borderRadius: radius.lg,
          padding: space.lg,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      <Ionicons
        name={selected ? "radio-button-on" : "radio-button-off"}
        size={20}
        color={selected ? c.blue : c.ink400}
      />
      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
  );
}

export function Toggle({
  label,
  hint,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  const { c, space, radius } = useTheme();
  return (
    <Pressable
      onPress={() => !disabled && onChange(!value)}
      style={{ flexDirection: "row", alignItems: "center", gap: space.md, opacity: disabled ? 0.5 : 1 }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: radius.sm,
          borderWidth: 1.5,
          borderColor: value ? c.blue : c.line,
          backgroundColor: value ? c.blue : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {value && <Ionicons name="checkmark" size={14} color="#ffffff" />}
      </View>
      <View style={{ flex: 1 }}>
        <Txt variant="body">{label}</Txt>
        {!!hint && (
          <Txt variant="caption" tone="faint">
            {hint}
          </Txt>
        )}
      </View>
    </Pressable>
  );
}

/** The one button style that commits something. */
export function PrimaryButton({
  label,
  onPress,
  busy = false,
  disabled = false,
  tone = "blue",
  icon,
  small = false,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  tone?: "blue" | "mint";
  icon?: keyof typeof Ionicons.glyphMap;
  /** For buttons inside a dense row — a comparison cell, a list item. */
  small?: boolean;
}) {
  const { c, space, radius } = useTheme();
  const dead = disabled || busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={dead}
      style={{
        backgroundColor: dead ? c.line : tone === "mint" ? c.mint : c.blue,
        borderRadius: radius.pill,
        paddingVertical: small ? space.sm : space.md,
        paddingHorizontal: small ? space.sm : undefined,
        alignItems: "center",
        justifyContent: "center",
        minHeight: small ? 34 : 48,
      }}
    >
      {busy ? (
        <ActivityIndicator color="#ffffff" />
      ) : (
        <Row gap="sm">
          {icon && <Ionicons name={icon} size={17} color={dead ? c.ink400 : "#ffffff"} />}
          <Txt
            variant={small ? "caption" : "label"}
            tone={dead ? "faint" : "onBlue"}
            numberOfLines={1}
          >
            {label}
          </Txt>
        </Row>
      )}
    </Pressable>
  );
}
