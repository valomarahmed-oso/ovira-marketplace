/**
 * Ovira's visual identity, ported from the storefront.
 *
 * These values are copied from `storefront/src/app/globals.css` — the same
 * hexes, the same names. A shopper who installs the app after using the site
 * should not feel they have arrived somewhere else, and the surest way to break
 * that is to eyeball a "close enough" blue. When the storefront palette changes,
 * change it here in the same commit.
 */

export type Palette = {
  blue: string;
  blue600: string;
  blue050: string;
  ink: string;
  ink600: string;
  ink400: string;
  line: string;
  canvas: string;
  surface: string;
  coral: string;
  coral050: string;
  mint: string;
  gold: string;
  hover: string;
};

export const light: Palette = {
  blue: "#0e8bff",
  blue600: "#0a6fd6",
  blue050: "#eaf3ff",
  ink: "#0b1f38",
  ink600: "#3a4a60",
  ink400: "#6b7a90",
  line: "#dbe6f5",
  canvas: "#f4f8ff",
  surface: "#ffffff",
  coral: "#ff5630",
  coral050: "#ffede8",
  mint: "#12b886",
  gold: "#f5b301",
  hover: "#dcebff",
};

export const dark: Palette = {
  blue: "#2f9bff",
  blue600: "#6cb6ff",
  blue050: "#15263f",
  ink: "#e8eefb",
  ink600: "#aab8cf",
  ink400: "#7e8ca4",
  line: "#243349",
  canvas: "#0a121f",
  surface: "#111c2e",
  coral: "#ff6f4d",
  coral050: "#2e1a16",
  mint: "#2ad19b",
  gold: "#f5c542",
  hover: "#1c3252",
};

/** The one scale used for every gap, pad and inset. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Corner radii. The storefront's cards are `rounded-2xl`; these match. */
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;

/**
 * Arabic needs more line height than Latin at the same size — descenders and
 * the tashkeel band collide otherwise. Every size here carries its own.
 */
export const typography = {
  display: { fontSize: 28, lineHeight: 40, fontWeight: "700" },
  title: { fontSize: 20, lineHeight: 30, fontWeight: "700" },
  heading: { fontSize: 17, lineHeight: 26, fontWeight: "600" },
  body: { fontSize: 15, lineHeight: 24, fontWeight: "400" },
  label: { fontSize: 13, lineHeight: 20, fontWeight: "500" },
  caption: { fontSize: 11, lineHeight: 18, fontWeight: "500" },
} as const;

/**
 * Shadows are written once because iOS and Android disagree about how to spell
 * them: iOS wants the four `shadow*` properties, Android only reads
 * `elevation`. Passing both keeps a card looking lifted on either.
 */
export function cardShadow(palette: Palette, level: 1 | 2 = 1) {
  return {
    shadowColor: palette.ink,
    shadowOpacity: level === 1 ? 0.06 : 0.12,
    shadowRadius: level === 1 ? 10 : 20,
    shadowOffset: { width: 0, height: level === 1 ? 2 : 8 },
    elevation: level === 1 ? 2 : 6,
  };
}
