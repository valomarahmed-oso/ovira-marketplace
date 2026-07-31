import type { Ionicons } from "@expo/vector-icons";

type IoniconName = keyof typeof Ionicons.glyphMap;

/**
 * Category icons are stored as **lucide** names, because that is what the web
 * storefront renders. The app draws Ionicons, so the two vocabularies have to be
 * reconciled somewhere — here, rather than by migrating the data and breaking
 * the website, or by shipping a second icon font to save a lookup table.
 *
 * An unmapped name falls back to a generic tile rather than rendering nothing:
 * a category the operator adds tomorrow must still be tappable today.
 */
const LUCIDE_TO_IONICON: Record<string, IoniconName> = {
  smartphone: "phone-portrait-outline",
  laptop: "laptop-outline",
  monitor: "desktop-outline",
  headphones: "headset-outline",
  watch: "watch-outline",
  camera: "camera-outline",
  "gamepad-2": "game-controller-outline",
  gamepad: "game-controller-outline",
  sparkles: "sparkles-outline",
  heart: "heart-outline",
  shirt: "shirt-outline",
  footprints: "footsteps-outline",
  lamp: "bulb-outline",
  sofa: "bed-outline",
  home: "home-outline",
  "utensils-crossed": "restaurant-outline",
  utensils: "restaurant-outline",
  "shopping-basket": "basket-outline",
  "shopping-bag": "bag-handle-outline",
  book: "book-outline",
  "book-open": "book-outline",
  dumbbell: "barbell-outline",
  bike: "bicycle-outline",
  car: "car-outline",
  baby: "happy-outline",
  "paw-print": "paw-outline",
  pill: "medkit-outline",
  stethoscope: "medkit-outline",
  wrench: "construct-outline",
  hammer: "hammer-outline",
  paintbrush: "brush-outline",
  music: "musical-notes-outline",
  gift: "gift-outline",
  flower: "flower-outline",
  leaf: "leaf-outline",
  tv: "tv-outline",
  printer: "print-outline",
  keyboard: "keypad-outline",
  package: "cube-outline",
};

export function categoryIcon(icon?: string | null): IoniconName {
  if (!icon) return "grid-outline";
  return LUCIDE_TO_IONICON[icon.trim().toLowerCase()] ?? "grid-outline";
}
