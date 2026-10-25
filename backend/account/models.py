from django.db import models

from account.utils import generate_unique_slug

class Customer(models.Model):
    customer_name = models.CharField(max_length=100)
    customer_email = models.EmailField(max_length=100, unique=True, blank=True, null=True)
    customer_phone = models.CharField(max_length=15, blank=True, null=True)
    customer_city = models.CharField(max_length=100, blank=True, null=True)
    customer_area = models.CharField(max_length=100, blank=True, null=True)
    customer_address = models.CharField(max_length=200, blank=True, null=True)
    customer_image = models.ImageField(upload_to='image/', blank=True, null=True)
    customer_password = models.CharField(max_length=200, blank=True, null=True)
    customer_role = models.CharField(max_length=20, default='customer')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
 
    # Show the customer's name.
    def __str__(self):
        return self.customer_name
    
class Restaurant(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    min_price = models.IntegerField(blank=True, null=True)
    max_price = models.IntegerField(blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    area = models.CharField(max_length=100, blank=True, null=True)
    location = models.CharField(max_length=200, blank=True, null=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    email = models.EmailField(max_length=100, unique=True, blank=True, null=True)
    phone_no = models.CharField(max_length=20, blank=True, null=True)
    business_reg_id = models.CharField(max_length=50, blank=True, null=True)
    owner_name = models.CharField(max_length=100, blank=True, null=True)
    logo = models.ImageField(upload_to='image/', blank=True, null=True)
    cover_image = models.ImageField(upload_to='image/', blank=True, null=True)
    password = models.CharField(max_length=200, blank=True, null=True)
    is_temporarily_closed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    slug = models.SlugField(unique=True, blank=True, null=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(latitude__isnull=True) | models.Q(latitude__gte=-90, latitude__lte=90),
                name='restaurant_latitude_in_range',
            ),
            models.CheckConstraint(
                condition=models.Q(longitude__isnull=True) | models.Q(longitude__gte=-180, longitude__lte=180),
                name='restaurant_longitude_in_range',
            ),
            models.CheckConstraint(
                condition=models.Q(latitude__isnull=True, longitude__isnull=True) | models.Q(latitude__isnull=False, longitude__isnull=False),
                name='restaurant_coordinates_come_in_pairs',
            ),
        ]

    # Remember the name the restaurant was loaded with.
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._loaded_name = self.__dict__.get('name')

    # Rebuild the slug when it is missing or the name changed, then save.
    def save(self, *args, **kwargs):
        if not self.slug or self.name != self._loaded_name:
            self.slug = generate_unique_slug(self, self.name)
        super().save(*args, **kwargs)
        self._loaded_name = self.name
 
    # Show the restaurant's name.
    def __str__(self):
        return self.name

class Admin(models.Model):
    admin_name = models.CharField(max_length=100, blank=True, null=True)
    admin_email = models.EmailField(max_length=100, unique=True, blank=True, null=True)
    admin_role = models.CharField(max_length=20, default='admin')
    admin_password = models.CharField(max_length=200, blank=True, null=True)
 
    # Show the admin's name.
    def __str__(self):
        return self.admin_name or ''
 
 
class UserAuth(models.Model):
    user_name = models.CharField(max_length=100, blank=True, null=True)
    user_email = models.EmailField(max_length=100, blank=True, null=True)
    user_password = models.CharField(max_length=200, blank=True, null=True)
    user_role = models.CharField(max_length=20, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
 
    class Meta:
        unique_together = ('user_email', 'user_role')
 
    # Tell DRF this login record always counts as authenticated.
    @property
    def is_authenticated(self):
        return True
 
    # Show the account's email and role.
    def __str__(self):
        return f"{self.user_name}-{self.user_role}"
    
class RestaurantRequest(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('declined', 'Declined'),
    )
 
    restaurant_name = models.CharField(max_length=200)
    restaurant_email = models.EmailField(max_length=100, unique=True, blank=True, null=True)
    restaurant_phone = models.CharField(max_length=20, blank=True, null=True)
    restaurant_business_reg_id = models.CharField(max_length=50, blank=True, null=True)
    restaurant_owner_name = models.CharField(max_length=100, blank=True, null=True)
    restaurant_city = models.CharField(max_length=100, blank=True, null=True)
    restaurant_area = models.CharField(max_length=100, blank=True, null=True)
    restaurant_location = models.CharField(max_length=200, blank=True, null=True)
    restaurant_password = models.CharField(max_length=200, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    decline_reason = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Show the requested restaurant name and its status.
    def __str__(self):
        return f"{self.restaurant_name} ({self.status})"

 
