from django.db import models
from account.models import Restaurant, Customer

class BookmarkRestaurant(models.Model):
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="bookmarks")
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name="bookmarks")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["customer", "restaurant"], name="unique_bookmark"),
        ]

    # Show which customer saved which restaurant.
    def __str__(self):
        return f"{self.customer} -> {self.restaurant}"
