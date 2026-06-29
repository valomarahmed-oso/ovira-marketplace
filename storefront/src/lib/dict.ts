import { getDict } from "@/lib/i18n";

// Legacy default dictionary (Arabic). Components that haven't migrated to the
// locale-aware `useI18n()` / `getDict()` still import `t` from here.
export const t = getDict("ar");
