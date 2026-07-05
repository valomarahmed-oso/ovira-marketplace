import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint, flt, get_datetime


class MarketplaceSponsoredPlacement(Document):
    def validate(self):
        if self.starts_on and self.ends_on and get_datetime(self.ends_on) <= get_datetime(self.starts_on):
            frappe.throw(_("The placement must end after it starts."))
        if flt(self.budget) < 0:
            frappe.throw(_("Budget can't be negative."))
        if flt(self.cpc) < 0:
            frappe.throw(_("Cost per click can't be negative."))
        for counter in ("clicks", "impressions"):
            if self.get(counter) is None:
                self.set(counter, 0)
        if self.spend is None:
            self.spend = 0
        # A budget below what's already spent would silently keep the campaign
        # paused — guard the operator against setting one by mistake.
        if flt(self.budget) and flt(self.budget) < flt(self.spend):
            frappe.throw(_("Budget is below the amount already spent ({0}).").format(flt(self.spend)))
        if cint(self.priority) < 0:
            self.priority = 0
