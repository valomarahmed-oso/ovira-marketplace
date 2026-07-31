"""How this app is allowed to fail.

`except Exception: frappe.log_error(...)` appears ~60 times in this codebase. The
instinct behind it is right — an order must not fail because an SMS did — but it
was applied uniformly, including to stock and money. That is how a store ended up
selling 98 units of an item ERPNext held 1 of, and completing returns that
refunded nothing: the code that should have shouted wrote a line to a log nobody
reads and carried on as if it had worked.

Three categories, and the choice between them is a judgement about consequence,
not about how likely the failure is:

``ignorable``
    A message didn't send, a counter didn't tick. The user's outcome is
    unchanged. Swallow it and log.

``deferrable``
    Real work that did not happen, but that a later run can still do — a stock
    reconciliation, a settlement booking. Swallow it, log it, and **record it so
    something asks again**. The order proceeds; the books catch up.

``critical``
    The customer's money, their stock, or their order is now wrong. **Raise.**
    Nothing downstream should treat a half-finished write as done.

Usage::

    with guard("stock reservation", CRITICAL, order=order.name):
        reserve_order_stock(order)

    with guard("abandoned-cart recovery", IGNORABLE):
        mark_recovered(...)

The context manager exists so the category is stated at the call site, in one
line, next to the thing being protected — a comment saying "best-effort" is not
checkable, and every one of them was already there while the bug shipped anyway.
"""

from contextlib import contextmanager

import frappe

IGNORABLE = "ignorable"
DEFERRABLE = "deferrable"
CRITICAL = "critical"


@contextmanager
def guard(what, severity=IGNORABLE, **context):
    """Run a block under a stated failure policy.

    `what` is a human phrase that will appear in the log title, so the entry says
    what was being attempted rather than only where it blew up.
    """
    try:
        yield
    except Exception:
        if severity == CRITICAL:
            # Let it propagate. The caller's transaction should roll back rather
            # than commit a partial truth.
            frappe.log_error(
                frappe.get_traceback(), "Ovira: %s FAILED (critical)" % what
            )
            raise
        frappe.log_error(
            message="%s\ncontext: %s" % (frappe.get_traceback(), context or {}),
            title="Ovira: %s failed (%s)" % (what, severity),
        )
        if severity == DEFERRABLE:
            _remember(what, context)


def _remember(what, context):
    """Leave a trace a sweep can find later.

    Deliberately best-effort *itself*: if we cannot even record the deferral, the
    original failure is still logged, and nothing about the customer's order
    changes. This must never be the thing that raises.
    """
    try:
        frappe.cache().sadd("ovira_deferred_work", "%s|%s" % (what, context.get("ref") or ""))
    except Exception:
        pass


def deferred_work():
    """What has been put off and not yet picked up — for the health screen."""
    try:
        return sorted(
            m.decode() if isinstance(m, bytes) else str(m)
            for m in (frappe.cache().smembers("ovira_deferred_work") or [])
        )
    except Exception:
        return []


def clear_deferred(entry=None):
    try:
        if entry:
            frappe.cache().srem("ovira_deferred_work", entry)
        else:
            frappe.cache().delete_value("ovira_deferred_work")
    except Exception:
        pass
