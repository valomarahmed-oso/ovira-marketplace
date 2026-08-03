/**
 * Collecting the money, after the order exists.
 *
 * The order is always created first and paid for second — that ordering is the
 * whole design. It means a gateway that fails, or a shopper who closes the
 * browser mid-payment, leaves a real order in `Pending Payment` that someone
 * can chase, rather than a lost basket nobody knows about.
 */

import { fileUrl } from "./config.js";
import { get, post } from "./http.js";

const NS = "ovira_marketplace.api.payment";

/** An offline method the operator configured — bank transfer, a wallet, etc. */
export type PaymentMethod = {
  name: string;
  method_name: string;
  method_name_en?: string | null;
  kind?: string | null;
  instructions?: string | null;
  instructions_en?: string | null;
  /** Where to send the money. Shown after the order is placed, not before. */
  account_details?: string | null;
  icon?: string | null;
};

export async function listPaymentMethods(): Promise<PaymentMethod[]> {
  const rows = (await get<PaymentMethod[]>(`${NS}.list_payment_methods`)) ?? [];
  return rows.map((m) => ({ ...m, icon: fileUrl(m.icon) ?? null }));
}

export type PaymentStart = {
  /** `cod` and `manual` collect nothing online; anything else redirects. */
  method?: string;
  redirect_url?: string;
};

/**
 * Start payment for an order.
 *
 * `token` is the order's capability token, and passing it is what lets a
 * **guest** pay: they have no session, and without it the server would refuse
 * an order it cannot prove they own.
 */
export function createPayment(
  order: string,
  token?: string | null,
  returnUrl?: string,
): Promise<PaymentStart> {
  return post(
    `${NS}.create_payment`,
    { order, token: token ?? undefined, return_url: returnUrl },
    "تعذّر بدء عملية الدفع.",
  );
}

/** Does this response mean "send them to a gateway"? */
export function needsRedirect(payment: PaymentStart | null): payment is PaymentStart & {
  redirect_url: string;
} {
  return (
    !!payment?.redirect_url && payment.method !== "cod" && payment.method !== "manual"
  );
}
