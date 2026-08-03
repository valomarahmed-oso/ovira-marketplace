import type { Review, ReviewSummary } from "@ovira/core";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";

import { dict, fill, formatDate, num } from "../i18n";
import { useSession } from "../session";
import { useTheme } from "../theme-context";
import { PrimaryButton } from "./form";
import { Rating } from "./rating";
import { Card, Row, Txt, VStack } from "./ui";

/** Tap a star to set the rating. The only input a review really needs. */
export function StarPicker({
  value,
  onChange,
  size = 30,
}: {
  value: number;
  onChange: (value: number) => void;
  size?: number;
}) {
  const { c, space } = useTheme();
  return (
    <Row gap="sm">
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable key={star} onPress={() => onChange(star)} hitSlop={4}>
          <Ionicons
            name={star <= value ? "star" : "star-outline"}
            size={size}
            color={star <= value ? c.gold : c.ink400}
            style={{ marginEnd: space.xs }}
          />
        </Pressable>
      ))}
    </Row>
  );
}

/**
 * How the stars are spread, not just their average.
 *
 * A 4.0 made of all fours and a 4.0 made of fives and ones are different
 * products, and the average alone hides which one this is.
 */
function Distribution({ reviews }: { reviews: Review[] }) {
  const { c, space, radius } = useTheme();
  if (reviews.length < 3) return null;

  const buckets = [5, 4, 3, 2, 1].map((star) => ({
    star,
    n: reviews.filter((r) => Math.round(r.rating) === star).length,
  }));

  return (
    <VStack gap="xs">
      {buckets.map((bucket) => (
        <Row key={bucket.star} gap="sm">
          <Txt variant="caption" tone="faint">
            {num(bucket.star)}
          </Txt>
          <Ionicons name="star" size={11} color={c.gold} />
          <View
            style={{
              flex: 1,
              height: 6,
              backgroundColor: c.line,
              borderRadius: radius.pill,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                width: `${(bucket.n / reviews.length) * 100}%`,
                height: "100%",
                backgroundColor: c.gold,
              }}
            />
          </View>
          <Txt variant="caption" tone="faint" style={{ minWidth: 22, textAlign: "left" }}>
            {num(bucket.n)}
          </Txt>
        </Row>
      ))}
      <View style={{ height: space.xs }} />
    </VStack>
  );
}

function ReviewRow({ review }: { review: Review }) {
  const t = dict();
  const { c } = useTheme();
  return (
    <VStack gap="xs">
      <Row justify="space-between">
        <Row gap="sm">
          <Txt variant="label">{review.author}</Txt>
          {/* The badge is the whole reason a stranger's opinion is worth
              anything, and the server is the only thing that can grant it. */}
          {review.verified && (
            <Row gap="xs">
              <Ionicons name="checkmark-circle" size={13} color={c.mint} />
              <Txt variant="caption" tone="mint">
                {t.rvVerified}
              </Txt>
            </Row>
          )}
        </Row>
        <Txt variant="caption" tone="faint">
          {formatDate(review.date)}
        </Txt>
      </Row>
      <Rating value={review.rating} size={13} />
      {!!review.body && (
        <Txt variant="body" tone="muted">
          {review.body}
        </Txt>
      )}
    </VStack>
  );
}

/**
 * The reviews block: the summary, the spread, the list, and the form.
 *
 * Used for a product and for a seller — the shapes are identical and the only
 * difference is which `onSubmit` it is handed, so there is one of these rather
 * than two that drift.
 */
export function ReviewsSection({
  summary,
  onSubmit,
  title,
  emptyBody,
}: {
  summary: ReviewSummary;
  onSubmit: (rating: number, body: string) => Promise<void>;
  title?: string;
  emptyBody?: string;
}) {
  const t = dict();
  const { c, space } = useTheme();
  const user = useSession((s) => s.user);

  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit(rating, body.trim());
      setOpen(false);
      setDone(true);
      setRating(0);
      setBody("");
    } catch (err) {
      setError((err as Error)?.message ?? t.loadFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <VStack gap="md">
      <Row justify="space-between">
        <Txt variant="heading">{title ?? t.rvTitle}</Txt>
        {summary.count > 0 && (
          <Txt variant="caption" tone="faint">
            {fill(t.reviewsCount, { n: num(summary.count) })}
          </Txt>
        )}
      </Row>

      {summary.count > 0 ? (
        <Card>
          <VStack gap="md">
            <Row gap="md">
              <Txt variant="display" tone="blue">
                {num(summary.avg, { decimals: 1 })}
              </Txt>
              <VStack gap="xs" style={{ flex: 1 }}>
                <Rating value={summary.avg} size={15} />
                <Txt variant="caption" tone="faint">
                  {fill(t.reviewsCount, { n: num(summary.count) })}
                </Txt>
              </VStack>
            </Row>
            <Distribution reviews={summary.reviews} />
          </VStack>
        </Card>
      ) : (
        <Txt variant="body" tone="faint">
          {emptyBody ?? t.rvEmpty}
        </Txt>
      )}

      {done && (
        <Txt variant="caption" tone="mint">
          {t.rvThanks}
        </Txt>
      )}

      {/* Only a signed-in shopper can review — the server ties the review to an
          account and refuses a guest, so offering the form would be a form that
          always fails. */}
      {user ? (
        open ? (
          <Card>
            <VStack gap="md">
              <Txt variant="label">{t.rvYour}</Txt>
              <StarPicker value={rating} onChange={setRating} />
              <TextArea value={body} onChange={setBody} placeholder={t.rvBodyHint} />
              {!!error && (
                <Txt variant="caption" tone="coral">
                  {error}
                </Txt>
              )}
              <PrimaryButton
                label={t.rvSend}
                icon="star-outline"
                busy={busy}
                disabled={rating < 1}
                onPress={() => void submit()}
              />
              <Pressable onPress={() => setOpen(false)} style={{ alignItems: "center" }}>
                <Txt variant="label" tone="faint">
                  {t.cancel}
                </Txt>
              </Pressable>
            </VStack>
          </Card>
        ) : (
          <Pressable onPress={() => setOpen(true)} style={{ alignSelf: "flex-start" }}>
            <Row gap="xs">
              <Ionicons name="create-outline" size={15} color={c.blue} />
              <Txt variant="label" tone="blue">
                {done ? t.rvEdit : t.rvWrite}
              </Txt>
            </Row>
          </Pressable>
        )
      ) : (
        <Txt variant="caption" tone="faint">
          {t.rvSignIn}
        </Txt>
      )}

      {summary.reviews.length > 0 && (
        <VStack gap="lg" style={{ marginTop: space.xs }}>
          {summary.reviews.map((review) => (
            <ReviewRow key={review.id} review={review} />
          ))}
        </VStack>
      )}
    </VStack>
  );
}

/** A free-text box that behaves under RTL. Shared by the review and Q&A forms. */
export function TextArea({
  value,
  onChange,
  placeholder,
  minHeight = 72,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  minHeight?: number;
}) {
  const { c, space, radius } = useTheme();
  return (
    <View
      style={{
        backgroundColor: c.canvas,
        borderWidth: 1,
        borderColor: c.line,
        borderRadius: radius.lg,
        padding: space.md,
      }}
    >
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.ink400}
        multiline
        style={{
          color: c.ink,
          fontSize: 15,
          minHeight,
          textAlign: "right",
          writingDirection: "rtl",
          paddingVertical: 0,
        }}
      />
    </View>
  );
}
