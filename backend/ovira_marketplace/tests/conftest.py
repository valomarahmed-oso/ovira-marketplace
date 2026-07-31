"""A `frappe` stand-in, so the money maths can be tested without a site.

These are unit tests: they cover the arithmetic that decides what a customer is
charged, what a vendor is billed back, what a shopper's points are worth and what
quantity ERPNext is told to hold. None of that needs a database, and requiring
one is exactly why this repo had no tests at all — `bench run-tests` wants a
provisioned site, so the bar for writing the first test was a whole environment.

The stub is installed ONLY when the real frappe isn't importable, so running this
suite from inside a bench (where `frappe` is real) uses the real thing instead of
silently testing a fake.

What is NOT covered here, and should not be faked into looking covered: anything
whose behaviour lives in the database — document hooks, permissions, submitted
ERPNext vouchers, the `on_update` transitions. Those need a real test site
(`bench --site <test-site> run-tests --app ovira_marketplace`) and are worth
adding, but a stub asserting against itself would prove nothing.
"""

import sys
import types


def _install_frappe_stub():
    frappe = types.ModuleType("frappe")

    def flt(value, precision=None):
        try:
            out = float(value or 0)
        except (TypeError, ValueError):
            out = 0.0
        return round(out, precision) if precision is not None else out

    def cint(value):
        try:
            return int(float(value or 0))
        except (TypeError, ValueError):
            return 0

    class ValidationError(Exception):
        pass

    def throw(msg, exc=ValidationError, title=None):
        raise exc(msg)

    utils = types.ModuleType("frappe.utils")
    utils.flt = flt
    utils.cint = cint
    utils.nowdate = lambda: "2026-01-01"
    utils.add_days = lambda d, n: d
    utils.now_datetime = lambda: None
    utils.fmt_money = lambda v, currency=None: f"{flt(v):.2f} {currency or ''}".strip()

    frappe.utils = utils
    frappe.flt = flt
    frappe.cint = cint
    frappe.throw = throw
    frappe.ValidationError = ValidationError
    frappe.DoesNotExistError = type("DoesNotExistError", (Exception,), {})
    frappe.PermissionError = type("PermissionError", (Exception,), {})
    frappe._ = lambda s: s
    frappe.log_error = lambda *a, **k: None
    frappe.get_traceback = lambda: ""

    # Enough of the package tree for the modules under test to IMPORT. Anything
    # that would actually touch a database raises, loudly — a unit test that
    # silently queried a stub would be worse than no test.
    def _needs_a_site(*_a, **_k):
        raise AssertionError(
            "this unit test reached the database; it belongs in a bench test suite"
        )

    frappe.get_all = _needs_a_site
    frappe.get_doc = _needs_a_site
    frappe.new_doc = _needs_a_site
    frappe.get_cached_doc = _needs_a_site
    frappe.db = types.SimpleNamespace(
        get_value=_needs_a_site, exists=_needs_a_site, set_value=_needs_a_site,
        sql=_needs_a_site, count=_needs_a_site, commit=lambda: None,
    )

    document = types.ModuleType("frappe.model.document")

    class Document:
        """Just enough for a controller class to be defined at import time."""

        def get(self, key, default=None):
            return getattr(self, key, default)

    document.Document = Document
    model = types.ModuleType("frappe.model")
    model.document = document
    frappe.model = model

    rate_limiter = types.ModuleType("frappe.rate_limiter")
    rate_limiter.rate_limit = lambda **_k: (lambda fn: fn)
    frappe.rate_limiter = rate_limiter

    frappe.whitelist = lambda **_k: (lambda fn: fn)

    sys.modules["frappe"] = frappe
    sys.modules["frappe.utils"] = utils
    sys.modules["frappe.model"] = model
    sys.modules["frappe.model.document"] = document
    sys.modules["frappe.rate_limiter"] = rate_limiter

    # `from frappe import _` needs the name on the package itself, which it has.
    return frappe


try:  # pragma: no cover - depends on where the suite is run
    import frappe  # noqa: F401
except ImportError:
    _install_frappe_stub()
