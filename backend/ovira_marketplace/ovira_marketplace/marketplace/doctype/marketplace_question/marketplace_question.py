from frappe.model.document import Document


class MarketplaceQuestion(Document):
    def validate(self):
        if not self.status:
            self.status = "Published"
