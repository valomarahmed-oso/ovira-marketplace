"""Where a tapped notification lands, per audience.

One event, three destinations. A seller who taps "new order" and is shown the
buyer's tracking page gets told the order isn't theirs — the notification is
then worse than none, because it cost them a tap and taught them not to trust
the next one.
"""

from ovira_marketplace.notifications.channels import push_url

ORDER = {"doctype": "Marketplace Order", "name": "OVR-000097"}


def test_buyer_goes_to_their_own_order():
    assert push_url({"audience": "buyer"}, ORDER) == "/shop/account/orders/OVR-000097"


def test_vendor_goes_to_their_own_slice_not_the_buyers_page():
    assert push_url({"audience": "vendor"}, ORDER) == "/shop/vendor/orders"


def test_operator_goes_to_the_console():
    assert push_url({"audience": "operator"}, ORDER) == "/shop/admin/orders"


def test_non_order_events_land_on_each_audiences_home():
    assert push_url({"audience": "buyer"}, None) == "/shop/account/notifications"
    assert push_url({"audience": "vendor"}, None) == "/shop/vendor"
    assert push_url({"audience": "operator"}, None) == "/shop/admin"


def test_an_unstamped_recipient_is_treated_as_a_buyer():
    # Explicit `recipients=` callers that predate the audience stamp must still
    # get a working link rather than a crash or a dead end.
    assert push_url({}, ORDER) == "/shop/account/orders/OVR-000097"
    assert push_url({}, None) == "/shop/account/notifications"


def test_a_reference_to_something_else_is_not_treated_as_an_order():
    other = {"doctype": "Marketplace Return", "name": "RET-1"}
    assert push_url({"audience": "vendor"}, other) == "/shop/vendor"
    assert push_url({"audience": "buyer"}, other) == "/shop/account/notifications"


def test_a_reference_without_a_name_is_not_an_order():
    assert push_url({"audience": "buyer"}, {"doctype": "Marketplace Order"}) == (
        "/shop/account/notifications"
    )
