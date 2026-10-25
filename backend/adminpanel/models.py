from django.db import models
from account.models import Restaurant,Customer

class RestaurantReport(models.Model):
   
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('reviewed', 'Reviewed'),
        ('resolved', 'Resolved'),
        ('dismissed', 'Dismissed'),
    )
 
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='reports')
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name='reports')
    description = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
 
    # Show who reported which restaurant.
    def __str__(self):
        return f"{self.restaurant.name} - ({self.status})"
