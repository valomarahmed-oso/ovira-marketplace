import { MAX_IMAGE_BYTES, uploadImage } from "@ovira/core";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from "react-native";

import { dict, num } from "../i18n";
import { useTheme } from "../theme-context";
import { Row, Txt, VStack } from "./ui";

/** A picked asset, reduced to what the uploader needs. */
function describe(asset: ImagePicker.ImagePickerAsset) {
  const name = asset.fileName || asset.uri.split("/").pop() || `photo-${Date.now()}.jpg`;
  // Android often reports no mimeType; deriving it from the extension is more
  // reliable than trusting the picker, and Frappe rejects a part with none.
  const ext = (name.split(".").pop() || "jpg").toLowerCase();
  const type = asset.mimeType || `image/${ext === "jpg" ? "jpeg" : ext}`;
  return { uri: asset.uri, name, type };
}

/**
 * Pick photos and upload them, in the order the seller chose.
 *
 * **Order is the feature, not a detail.** Frappe's gallery treats the first
 * image as the primary one — it is what every product tile in the shop shows —
 * so the list is reorderable and says which one that is.
 *
 * Uploads happen on pick rather than on save. A seller who fills in a long
 * form and then waits through six uploads at the end will assume the app has
 * hung; and a failed upload at that point loses the form.
 */
export function ImageUpload({
  images,
  onChange,
  max = 8,
  single = false,
  label,
}: {
  images: string[];
  onChange: (images: string[]) => void;
  max?: number;
  /** One image, replaced rather than appended — a logo or a banner. */
  single?: boolean;
  label?: string;
}) {
  const t = dict();
  const { c, space, radius } = useTheme();
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t.uplTitle, t.uplPermission);
      return;
    }

    const remaining = single ? 1 : Math.max(0, max - images.length);
    if (remaining <= 0) {
      Alert.alert(t.uplTitle, t.uplFull);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: !single,
      selectionLimit: remaining,
      quality: 0.85,
    });
    if (result.canceled || !result.assets.length) return;

    setBusy(true);
    const uploaded: string[] = [];
    const failed: string[] = [];
    for (const asset of result.assets) {
      // Checked before the request rather than after: a 12 MB photo on a phone
      // connection is a long wait to be told no.
      if (asset.fileSize && asset.fileSize > MAX_IMAGE_BYTES) {
        failed.push(t.uplTooBig);
        continue;
      }
      try {
        uploaded.push(await uploadImage(describe(asset)));
      } catch (err) {
        failed.push((err as Error)?.message ?? t.uplFailed);
      }
    }
    setBusy(false);

    // Whatever succeeded is kept. Discarding four good uploads because the
    // fifth failed is the wrong trade on a phone connection.
    if (uploaded.length) onChange(single ? uploaded.slice(0, 1) : [...images, ...uploaded]);
    if (failed.length) Alert.alert(t.uplTitle, failed[0]);
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= images.length) return;
    const next = [...images];
    const [moved] = next.splice(from, 1);
    if (moved) next.splice(to, 0, moved);
    onChange(next);
  };

  const size = single ? 96 : 84;

  return (
    <VStack gap="sm">
      <Row justify="space-between">
        <Txt variant="caption" tone="faint">
          {label ?? t.uplImages}
        </Txt>
        {!single && (
          <Txt variant="caption" tone="faint">
            {num(images.length)} / {num(max)}
          </Txt>
        )}
      </Row>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {images.map((url, index) => (
          <View key={`${url}-${index}`} style={{ width: size }}>
            <View>
              <Image
                source={url}
                style={{
                  width: size,
                  height: size,
                  borderRadius: radius.md,
                  backgroundColor: c.blue050,
                  borderWidth: index === 0 && !single ? 2 : 1,
                  borderColor: index === 0 && !single ? c.blue : c.line,
                }}
                contentFit="cover"
                transition={150}
              />
              <Pressable
                onPress={() => onChange(images.filter((_, i) => i !== index))}
                hitSlop={8}
                style={{
                  position: "absolute",
                  top: -6,
                  end: -6,
                  backgroundColor: c.surface,
                  borderRadius: radius.pill,
                  borderWidth: 1,
                  borderColor: c.line,
                  padding: 2,
                }}
              >
                <Ionicons name="close" size={13} color={c.coral} />
              </Pressable>
            </View>

            {!single && (
              <Row justify="space-between" style={{ marginTop: 2 }}>
                {/* Under RTL "back" points the way the list runs, so `chevron-back`
                    moves an image later and `forward` moves it earlier. */}
                <Pressable onPress={() => move(index, index - 1)} hitSlop={6}>
                  <Ionicons name="chevron-forward" size={15} color={index === 0 ? c.line : c.ink400} />
                </Pressable>
                {index === 0 ? (
                  <Txt variant="caption" tone="blue">
                    {t.uplPrimary}
                  </Txt>
                ) : (
                  <Txt variant="caption" tone="faint">
                    {num(index + 1)}
                  </Txt>
                )}
                <Pressable onPress={() => move(index, index + 1)} hitSlop={6}>
                  <Ionicons
                    name="chevron-back"
                    size={15}
                    color={index === images.length - 1 ? c.line : c.ink400}
                  />
                </Pressable>
              </Row>
            )}
          </View>
        ))}

        <Pressable
          onPress={() => void pick()}
          disabled={busy}
          style={{
            width: size,
            height: size,
            borderRadius: radius.md,
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: c.blue,
            backgroundColor: c.blue050,
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
          }}
        >
          {busy ? (
            <ActivityIndicator color={c.blue} />
          ) : (
            <>
              <Ionicons name="camera-outline" size={22} color={c.blue} />
              <Txt variant="caption" tone="blue">
                {images.length && single ? t.uplReplace : t.uplAdd}
              </Txt>
            </>
          )}
        </Pressable>
      </ScrollView>

      {!single && images.length > 1 && (
        <Txt variant="caption" tone="faint">
          {t.uplPrimaryHint}
        </Txt>
      )}
    </VStack>
  );
}
