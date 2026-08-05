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
  category/[slug].tsx   listing with sort, in-stock filter, paging
  product/[slug].tsx    gallery, variants, bulk tiers, seller, related
  checkout.tsx          address · delivery · courier · payment · coupon · credit
  auth/                 sign-in · register
  account/              orders · addresses · wallet · points
  order/[name].tsx      items, totals, tracking, cancel, re-order
  vendor/               seller: what needs packing, what it earned, ship it
  scan.tsx              barcode → product
src/
  theme.ts              palette, spacing, type scale — mirrors the storefront
  theme-context.tsx     useTheme(), follows the system light/dark setting
  i18n.ts               strings + num()/money(); ar and en stay key-parallel
  ovira.ts              the only file that knows a network exists
  rtl.ts                direction
  icons.ts              category icons: lucide names (from the web) → Ionicons
  cart-store.ts         local cart, persisted; prices here are display only
  session.ts            who is signed in; pushes the CSRF token into the API layer
  notifications.ts      push permission, Expo token, tap payloads
  deep-links.ts         one URL→screen map, with tests
  app-lock.tsx          biometric gate
  device-prefs.ts       push + app-lock switches, per device
  vendor-access.ts      who may see the seller area (and why not)
  store-config.ts       currency / tax / mode, fetched once per run
  components/           Txt · Screen · Card · Row · VStack · Pill · Logo ·
                        ProductTile · ProductGrid · Price · Rating · Gallery ·
                        SearchBar · Empty/Failed/Loading
```

## The cart is not a price

`cart-store.ts` holds what the shopper picked and what they were *shown*.
`api/checkout.place_order` recomputes every figure from the database and ignores
what the client sends — bulk tiers, coupons, shipping and tax included. Keep it
that way: the cart is the one place a client is tempted to become the authority
on money.

A line stores the **base** unit price plus the product's tiers; the effective
price is derived from the quantity by `lineUnitPrice()`. Storing an already
discounted figure is how a cart came to bill six units at full price after five
of them had earned the bulk rate.

Shipping is never computed here either — `shippingQuote()` asks the server on
every change of governorate or method, because this store prices delivery two
incompatible ways depending on a setting.

## The seller area is deliberately small

`vendor/` answers the two questions a seller has while standing in a stockroom —
*what do I owe someone today* and *what am I earning* — and books a shipment.
Product editing, coupons, reports and settlement statements stay on the web,
linked and named as such. A 6-inch port of a twelve-screen console is worse than
a link to the real one.

It is gated on **two** conditions, and the second is the easy one to forget: the
person must be a vendor, **and** the store must be running as a marketplace. In
Single Company mode there are no sellers, and offering "my store" invents one.

## The three build profiles

`eas.json` is schema-validated and **rejects `"//"` comment keys**, so the
reasoning lives here instead. Three profiles for three different questions:

| profile | the question it answers | output |
|---|---|---|
| `development` | does the native code work on my phone? | `.apk` + dev client |
| `preview` | can I hand this to someone? | `.apk` |
| `production` | is this what goes to the store? | `.aab` |

**`preview` is the one to build first.** An `.apk` installs by tapping the file —
no Play Store, no cable, no Android Studio — and unlike Expo Go it contains the
real native modules, so push, biometrics and the camera actually work.

All three point `EXPO_PUBLIC_FRAPPE_URL` at demo.ovira.cloud.

## Where this is going

Shipped: the shell, browsing, buying, the native layer (push, biometrics,
barcode, deep links) and the seller view. Next: bringing the same polish back to
the PWA.
