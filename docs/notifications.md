# Notifications

How the marketplace tells people what happened: one event pipeline behind every
in-app badge, push, email, WhatsApp and SMS message.

## Why a pipeline

Before this, each feature fanned out on its own — `Marketplace Order.on_update`
had three separate `try/except` blocks (in-app, email, WhatsApp), all inline and
synchronous. That shape has four problems a store feels quickly:

- a slow provider slows the checkout that triggered it;
- a retried request (or a doc saved twice) sends the same message twice;
- a failed send is gone — nothing retries it and nothing records it;
- the buyer can't choose what they get, and the operator can't edit a word of it
  without a deploy.

So the code now raises **events**, and one engine decides who hears about them,
in which language, over which channel, with retries and an audit trail.

```
feature code ──emit(event, context)──▶ registry ─▶ recipients ─▶ templates
                                                        │
                                              Outbox rows (queued)
                                                        │
                                    worker ─▶ in-app · push · email · WhatsApp · SMS
                                                        │
                                            sent / failed+retry / skipped
```

## The rules it follows

| Decision | Rule |
|---|---|
| Transactional vs marketing | Order receipts, shipping, OTP and refunds are **transactional and cannot be switched off** — the same line Amazon draws. Cart reminders, price drops, deals and back-in-stock are **marketing** and always opt-out (opt-in at signup). |
| Channel order | WhatsApp first where it's connected, email always for anything with a receipt, **SMS only as an OTP fallback** because it is the one channel that costs per message. |
| Language | The recipient's stored language, falling back to Arabic. |
| Vendors | Immediate for a new order; everything else is batched into a digest so a busy store doesn't drown them. |
| Failure | A notification must never break the thing that triggered it. Every send is queued, retried three times with backoff, and recorded either way. |
| Duplicates | Every (event, reference, recipient, channel) is written once. A replayed hook or a double save cannot send twice. |

## Event catalog

Events live in `notifications/events.py` — one entry per event, carrying its
audience, whether it's transactional, its default channels, and its bilingual
content. Adding an event is one dict entry plus one `emit()` call.

| Group | Events |
|---|---|
| Order | `order.placed` `order.paid` `order.processing` `order.shipped` `order.out_for_delivery` `order.delivery_otp` `order.delivered` `order.cancelled` |
| Returns & money | `return.requested` `return.approved` `return.rejected` `return.completed` `order.refund_completed` |
| Post-purchase | `loyalty.earned` `review.request` |
| Marketing (opt-out) | `cart.abandoned` `product.back_in_stock` `price.drop` |
| Account | `account.welcome` |
| Vendor | `vendor.new_order` `vendor.payout_settled` `vendor.low_stock` `vendor.review_received` |
| Operator | `operator.cod_flagged` `operator.support_ticket` |

## Content

One content block per event per language — a **title** and a list of **lines**.
Each channel renders that block the way its medium wants:

- **email** — the branded RTL/LTR HTML shell, subject = title
- **WhatsApp / SMS** — title, blank line, then the lines as plain text
- **in-app / push** — title + the first line

That's deliberate: a store writes the message once instead of maintaining four
near-identical copies that drift apart. Phase 2 adds a
`Marketplace Notification Template` DocType so an operator can override any
block from the admin UI, in either language, with the code defaults as the
fallback.

## The outbox

`Marketplace Notification Outbox` is the audit trail and the retry queue in one
record per (event × recipient × channel):

`event · channel · recipient · language · status · attempts · last_error ·
provider_id · dedupe_key (unique) · reference · sent_at · next_attempt_at`

`status`: `queued` → `sent`, or `failed` after three attempts, or `skipped` when
a preference or a missing channel ruled it out (skips are recorded too — "why
didn't the customer get this?" is the question you actually have to answer).

The hub's own `Ovira Message Log` still records what left over WhatsApp/SMS/email;
the outbox is the marketplace-level truth **across every channel**, including the
in-app and push ones the hub never sees.

## Phases

1. **Foundation** ✅ — registry, outbox, engine, adapters, and every existing
   call site moved onto `emit()`.
2. **Content** ✅ — `Marketplace Notification Template` overrides the shipped
   wording per event per language, edited from Admin → Notifications with a live
   preview against sample values. Deleting an override falls back to code, so an
   edit survives an upgrade and a new event ships working.
3. **Control** ✅ — `Marketplace Notification Preference` per recipient (marketing
   email/push), a signed unsubscribe link in every marketing email that works
   without a login, and quiet hours (`Marketplace Settings`) that **hold**
   marketing until morning rather than dropping it. Transactional traffic ignores
   all three by design.
4. **Coverage** ✅ — 24 events wired: the order lifecycle, returns and the
   completed refund, the delivery code, welcome, loyalty, abandoned carts,
   back-in-stock, review requests, and the vendor/operator side (new order, payout
   settled, low-stock digest, new review, flagged cash-on-delivery). Two are
   time-triggered rather than action-triggered and live in
   `notifications/sweeps.py`: the review request a few days after delivery, and
   one low-stock digest per vendor per day — a message per product is the fastest
   way to teach a vendor to ignore the channel — and `price.drop`, which compares
   today's price against `Marketplace Price Watch`: one baseline number per
   (shopper, product), not a price history, because the only question is "cheaper
   than when they last looked?". A first sighting is recorded silently, a drop
   must clear 5%, and it must beat the price we last announced so a slow slide
   doesn't message someone daily.

   **Not built, and deliberately so:** expiring loyalty points. `Marketplace
   Loyalty Entry` has no expiry date — points don't expire in this store today.
   Adding the notification would mean first deciding how long points live and how
   expiry is booked, which is a policy change to the loyalty programme, not a
   notification.
5. **Operations** ✅ — the outbox screen: a week-at-a-glance count per status
   (failed is coloured, because it's the one worth checking), click a count to
   filter, read the exact failure or skip reason, re-send in one click.

## Adding an event

```python
# 1. describe it
"order.shipped": Event(
    audience=BUYER, transactional=True,
    channels=("inapp", "email", "whatsapp"),
    ar=Content("تم شحن طلبك 📦", ["رقم الطلب: {order}", "هيوصلك خلال {eta}"]),
    en=Content("Your order shipped 📦", ["Order: {order}", "Arriving in {eta}"]),
),

# 2. raise it where it happens
emit("order.shipped", {"order": doc.name, "eta": "٢-٤ أيام"}, doc=doc)
```

Nothing else. Routing, language, queueing, retries, dedupe and the audit row are
the engine's job.
