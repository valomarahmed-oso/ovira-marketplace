# Ovira — mobile app

A real native buyer app (iOS + Android) built with **Expo SDK 57** and
**expo-router**, sharing its entire non-UI half with the web storefront through
[`@ovira/core`](../packages/core).

The split is the point. Types, endpoints and money maths are written once in
`packages/core`; only the screens are written twice. That is what makes a second
client affordable for one developer, and it is why the price a shopper sees in
the app cannot drift away from the price on the invoice.

## Running it

```bash
cd mobile
npm install
npm start          # then scan the QR with Expo Go
```

| | |
|---|---|
| `npm start` | dev server; open on a phone with **Expo Go** |
| `npm run android` / `npm run ios` | open in an emulator/simulator |
| `npm run web` | the same bundle in a browser — used for quick checks |
| `npm run typecheck` | `tsc --noEmit` |

With no `.env` the app talks to **demo.ovira.cloud**. Point it elsewhere with
`EXPO_PUBLIC_FRAPPE_URL` (see `.env.example`) — that value is inlined into the
bundle, so only public origins belong there.

`@ovira/core` is consumed as a built package. After editing anything under
`packages/core/src`, rebuild it — `npm run build` there, or `npm run dev` for a
watcher — or Metro keeps serving the previous version.

## Things worth knowing before changing this

**Right-to-left is the app's normal direction, not a mode.** It is switched on
in two places because two renderers each own half of it: the
`expo-localization` config plugin sets `forcesRTL` in the native project (so a
built app is RTL from its first frame), and `src/rtl.ts` sets it at runtime for
Expo Go and for the document on web. Write `flexDirection: "row"` and let the
framework flip it — hand-flipping to `row-reverse` looks right in Expo Go and
double-flips in a real build.

**All text goes through `<Txt>`, all numbers through `num()`/`money()`.** `Txt`
carries the palette colour and the `writingDirection` that stops a title
beginning with "iPhone" from jumping to the wrong side of a column. `num()`
keeps quantities in the same Arabic-Indic digits as prices; formatting one and
not the other puts two numbering systems on one line.

**The colours in `src/theme.ts` are copied from the storefront's `globals.css`,
by hex.** Change them together, or the app and the site stop looking like the
same company.

**The dev proxy in `metro.config.js` only exists for `npm run web`.** React
Native's fetch is a native HTTP client with no origin, so a phone calls the
Frappe site directly and CORS never applies; a browser can't, so Metro forwards
`/api/*` itself rather than a production site being opened up to suit a
development tool.

## Layout

```
app/                    routes (expo-router; file = screen)
  _layout.tsx           RTL, core config, theme, splash
  (tabs)/               الرئيسية · البحث · السلة · حسابي
src/
  theme.ts              palette, spacing, type scale — mirrors the storefront
  theme-context.tsx     useTheme(), follows the system light/dark setting
  i18n.ts               shell strings; ar and en stay key-parallel
  ovira.ts              the only file that knows a network exists
  rtl.ts                direction
  components/           Txt · Screen · Card · Row · VStack · Pill · Logo
```

## Where this is going

Shipped: the shell — navigation, theme, RTL, and a live connection to the store.
Next: browse screens, then cart and checkout, then the native layer (push,
biometrics, barcode, deep links) that is the actual reason for building this
rather than wrapping the website.
