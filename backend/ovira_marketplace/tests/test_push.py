"""How the app decides a phone has gone away.

Getting this wrong is quiet in both directions: too eager, and shoppers whose
phones are fine stop receiving order updates with nothing in any log; too shy,
and every uninstalled app is retried forever.
"""

from ovira_marketplace.api.push import read_tickets

TOKENS = ["ExponentPushToken[a]", "ExponentPushToken[b]", "ExponentPushToken[c]"]


def test_all_accepted():
    accepted, dead = read_tickets(TOKENS, [{"status": "ok"}] * 3)
    assert accepted == 3
    assert dead == []


def test_only_device_not_registered_is_pruned():
    accepted, dead = read_tickets(
        TOKENS,
        [
            {"status": "ok"},
            {"status": "error", "details": {"error": "DeviceNotRegistered"}},
            {"status": "error", "details": {"error": "MessageRateExceeded"}},
        ],
    )
    assert accepted == 1
    # The rate-limited one is a transient failure. Deleting it would unsubscribe
    # a working phone because Expo was briefly busy.
    assert dead == ["ExponentPushToken[b]"]


def test_error_without_details_is_kept():
    _accepted, dead = read_tickets(TOKENS[:1], [{"status": "error"}])
    assert dead == []


def test_short_reply_does_not_condemn_the_rest():
    # Expo answered for one of three. The other two are unknown, not dead.
    accepted, dead = read_tickets(TOKENS, [{"status": "ok"}])
    assert accepted == 1
    assert dead == []


def test_missing_reply_is_survivable():
    assert read_tickets(TOKENS, None) == (0, [])
    assert read_tickets(TOKENS, []) == (0, [])


def test_null_ticket_entries_are_ignored():
    accepted, dead = read_tickets(TOKENS, [None, {"status": "ok"}, None])
    assert accepted == 1
    assert dead == []
