"""The support queue — the bug that started the whole audit.

`_unread_counts` asked `get_all` for `count(name) as n`, which frappe v16
rejects. It threw for every caller, and BOTH `my_tickets` and `all_tickets` go
through it, so a working ticket system rendered empty on the buyer's page and the
operator's over a table that had rows in it. The storefront's API layer swallowed
the 500 and showed "no tickets".

The lesson generalises: assert that a WRITE is READABLE afterwards, by the person
who made it and by the person who has to answer it. Testing `create_ticket`
alone would have passed the whole time.
"""

import frappe
from frappe.tests import IntegrationTestCase

from ovira_marketplace.tests import fixtures as fx


class TestSupportTickets(IntegrationTestCase):
    def setUp(self):
        self.email = "ticket.buyer@ovira.test"
        fx.buyer(self.email, "Ticket Buyer")

    def tearDown(self):
        frappe.set_user("Administrator")

    def test_a_ticket_the_customer_opened_is_a_ticket_the_customer_can_see(self):
        from ovira_marketplace.api.support import create_ticket, my_tickets

        frappe.set_user(self.email)
        created = create_ticket(subject="مرتجع", body="المنتج وصل تالف", category="Return")

        mine = my_tickets()
        self.assertEqual([t["name"] for t in mine], [created["name"]])
        self.assertEqual(mine[0]["subject"], "مرتجع")

    def test_the_operator_queue_shows_it_too(self):
        from ovira_marketplace.api.support import all_tickets, create_ticket

        frappe.set_user(self.email)
        created = create_ticket(subject="سؤال", body="متى يصل طلبي؟")

        frappe.set_user("Administrator")
        queue = all_tickets()
        self.assertIn(created["name"], [t["name"] for t in queue["tickets"]])
        self.assertGreaterEqual(queue["open_count"], 1)

    def test_unread_counts_are_computed_not_thrown(self):
        """The precise regression: the aggregate query itself.

        A customer's opening message is unread FOR SUPPORT, and support's reply is
        unread for the customer. Both sides go through the query that used to
        raise ValidationError.
        """
        from ovira_marketplace.api.support import all_tickets, create_ticket, my_tickets, reply

        frappe.set_user(self.email)
        created = create_ticket(subject="عطل", body="الجهاز لا يعمل")

        frappe.set_user("Administrator")
        queue = all_tickets()
        row = next(t for t in queue["tickets"] if t["name"] == created["name"])
        self.assertEqual(row["unread"], 1, "support should see the customer's message as unread")

        reply(created["name"], "بنراجع المشكلة دلوقتي")

        frappe.set_user(self.email)
        mine = next(t for t in my_tickets() if t["name"] == created["name"])
        self.assertEqual(mine["unread"], 1, "the customer should see support's reply as unread")

    def test_opening_the_thread_marks_it_read_for_that_side_only(self):
        from ovira_marketplace.api.support import all_tickets, create_ticket, ticket

        frappe.set_user(self.email)
        created = create_ticket(subject="استفسار", body="هل يوجد ضمان؟")

        frappe.set_user("Administrator")
        ticket(created["name"])  # support opens it
        row = next(t for t in all_tickets()["tickets"] if t["name"] == created["name"])
        self.assertEqual(row["unread"], 0)

    def test_a_ticket_is_not_visible_to_another_shopper(self):
        from ovira_marketplace.api.support import create_ticket, my_tickets, ticket

        frappe.set_user(self.email)
        created = create_ticket(subject="خاص", body="بيانات حسابي")

        other = "other.buyer@ovira.test"
        fx.buyer(other, "Other Buyer")
        frappe.set_user(other)
        self.assertEqual(my_tickets(), [])
        with self.assertRaises(frappe.PermissionError):
            ticket(created["name"])
