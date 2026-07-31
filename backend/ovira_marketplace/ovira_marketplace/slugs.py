"""URL slugs that survive the trip to the browser and back.

An Arabic-first store naturally produces Arabic slugs — `frappe.scrub` passes
non-Latin letters straight through, so "الكمبيوتر و مستلزماته" became the slug
"الكمبيوتر-و-مستلزماته". That looks fine in the database and breaks everywhere
else:

* every link percent-encodes it, and **Next 15 hands dynamic-route params back
  still encoded**, so the page searches for "%D8%A7%D9%84…", matches nothing,
  and renders an empty result with the escape sequence as its heading;
* canonical URLs, sitemaps, share links and access logs all become unreadable;
* search engines index the encoded form.

So slugs are transliterated to ASCII at the source. The display name is
untouched — only the address is Latinised.
"""

import re

import frappe

# Arabic → Latin. Chosen for how Egyptians actually write their words in Latin
# script (ج → g, not j), because the slug is read by people as often as machines.
_ARABIC = {
    "ا": "a", "أ": "a", "إ": "i", "آ": "a", "ٱ": "a",
    "ب": "b", "ت": "t", "ث": "th", "ج": "g", "ح": "h", "خ": "kh",
    "د": "d", "ذ": "dh", "ر": "r", "ز": "z", "س": "s", "ش": "sh",
    "ص": "s", "ض": "d", "ط": "t", "ظ": "z", "ع": "a", "غ": "gh",
    "ف": "f", "ق": "q", "ك": "k", "ل": "l", "م": "m", "ن": "n",
    "ه": "h", "و": "w", "ي": "y", "ى": "a", "ة": "a",
    "ئ": "y", "ؤ": "w", "ء": "",
    # Tatweel and the short-vowel marks carry no sound worth spelling out.
    "ـ": "", "ً": "", "ٌ": "", "ٍ": "", "َ": "",
    "ُ": "", "ِ": "", "ّ": "", "ْ": "", "ٰ": "",
}

# Arabic-Indic digits, which appear in titles as often as Western ones.
_DIGITS = {d: str(i) for i, d in enumerate("٠١٢٣٤٥٦٧٨٩")}
_DIGITS.update({d: str(i) for i, d in enumerate("۰۱۲۳۴۵۶۷۸۹")})

_TABLE = {**_ARABIC, **_DIGITS}


def transliterate(text):
    """Best-effort ASCII rendering of `text`. Unknown characters are dropped."""
    out = []
    for ch in str(text or ""):
        if ch in _TABLE:
            out.append(_TABLE[ch])
        elif ch.isascii():
            out.append(ch)
        else:
            out.append(" ")  # any other script separates words rather than joining them
    return "".join(out)


def web_slug(text, fallback=None):
    """A URL-safe slug: lowercase ASCII letters, digits and single hyphens.

    Falls back to `fallback` (normally the docname) when nothing usable
    survives — an emoji-only title still needs a working address, and a plain
    ugly URL beats a pretty broken one.
    """
    raw = transliterate(text).lower()
    raw = re.sub(r"[^a-z0-9]+", "-", raw).strip("-")
    raw = re.sub(r"-{2,}", "-", raw)
    return raw or (str(fallback or "").lower() or None)


def unique_slug(doctype, text, fallback=None, exclude=None):
    """`web_slug` plus a numeric suffix when the slug is already taken.

    Two products called "سماعة بلوتوث" transliterate identically; without this
    the second one silently shadows the first, and one of them becomes
    unreachable.
    """
    base = web_slug(text, fallback)
    if not base:
        return None
    candidate, n = base, 1
    while True:
        clash = frappe.db.get_value(doctype, {"slug": candidate}, "name")
        if not clash or clash == exclude:
            return candidate
        n += 1
        candidate = f"{base}-{n}"


_VALID = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def is_web_slug(slug):
    """True only for a slug that is actually safe in a URL.

    Stricter than "is it ASCII", which was the first version of this check and
    let through `????-????????` — a real row on this store, where an early write
    on a non-utf8mb4 connection replaced every Arabic letter with a literal `?`.
    That passes an ASCII test and still destroys the URL, because `?` starts the
    query string. Spaces, `%`, `#` and a trailing hyphen fail for the same
    reason: the address has to survive being pasted somewhere.
    """
    return bool(slug) and bool(_VALID.match(str(slug)))



def resolve(doctype, slug, extra_filters=None):
    """Find a record by slug, accepting the pre-Latinisation form.

    Returns ``(name, canonical_slug)`` or ``(None, None)``.

    Links shared before slugs were transliterated point at the Arabic form. No
    mapping table is needed to honour them: transliterating the OLD slug produces
    the NEW one, because hyphens are word separators either way
    (``الكمبيوتر-و-مستلزماته`` → ``alkmbywtr-w-mstlzmath``, which is exactly what
    the title itself produced). So an exact miss is retried through `web_slug`,
    and the caller can answer with a permanent redirect to the canonical address
    instead of a dead page.
    """
    if not slug:
        return None, None
    filters = dict(extra_filters or {})
    row = frappe.db.get_value(doctype, dict(filters, slug=slug), ["name", "slug"], as_dict=True)
    if row:
        return row.name, row.slug
    latinised = web_slug(slug)
    if latinised and latinised != slug:
        row = frappe.db.get_value(
            doctype, dict(filters, slug=latinised), ["name", "slug"], as_dict=True
        )
        if row:
            return row.name, row.slug
    return None, None
