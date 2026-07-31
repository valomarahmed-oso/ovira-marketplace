"""Slugs that survive a URL.

An Arabic slug percent-encodes in every link and comes back from Next's router
still encoded, so the page searches for "%D8%A7%D9%84…" and finds nothing. These
lock the transliteration down — including the fallback, because a title with no
Latinisable characters at all still needs a working address.
"""

from ovira_marketplace.slugs import is_ascii_slug, transliterate, web_slug


class TestWebSlug:
    def test_the_category_that_broke(self):
        assert web_slug("الكمبيوتر و مستلزماته") == "alkmbywtr-w-mstlzmath"

    def test_a_product_title(self):
        assert web_slug("رواكول") == "rwakwl"

    def test_latin_titles_are_left_recognisable(self):
        assert web_slug("Wireless ANC Headphones") == "wireless-anc-headphones"

    def test_trailing_space_does_not_become_a_trailing_hyphen(self):
        # The live catalogue had "سماعة-بلوتوث-" and "testtest-" — real slugs,
        # with a dangling hyphen from a title typed with a trailing space.
        assert web_slug("Testtest ") == "testtest"
        assert not web_slug("سماعة بلوتوث ").endswith("-")

    def test_runs_of_punctuation_collapse(self):
        assert web_slug("65W  GaN --- Charger!!") == "65w-gan-charger"

    def test_arabic_indic_digits_become_western(self):
        assert web_slug("شاحن ٦٥ واط") == "shahn-65-wat"

    def test_mixed_script(self):
        assert web_slug("ساعة AMOLED ذكية") == "saaa-amoled-dhkya"

    def test_falls_back_when_nothing_survives(self):
        # An emoji-only title has no Latin form; the docname is a working URL.
        assert web_slug("🎧🎧", fallback="PRD-00091") == "prd-00091"

    def test_no_fallback_and_nothing_usable_returns_none(self):
        assert web_slug("🎧") is None

    def test_output_is_always_url_safe(self):
        for title in ["الكمبيوتر و مستلزماته", "Café Crème!", "  ", "منتج ١٢٣"]:
            slug = web_slug(title, fallback="PRD-1")
            assert slug == slug.lower()
            assert " " not in slug
            assert slug.isascii()


class TestTransliterate:
    def test_egyptian_jim_is_g_not_j(self):
        # How Egyptians actually write it in Latin script — the slug is read by
        # people as often as by machines.
        assert "g" in transliterate("جمال")

    def test_diacritics_are_dropped_not_spelled(self):
        assert web_slug("مُحَمَّد") == web_slug("محمد")


class TestIsAsciiSlug:
    def test_detects_the_broken_ones(self):
        assert not is_ascii_slug("رواكول")
        assert is_ascii_slug("rwakwl")

    def test_empty_is_not_a_slug(self):
        assert not is_ascii_slug("")
        assert not is_ascii_slug(None)
