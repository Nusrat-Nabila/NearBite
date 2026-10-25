from django.contrib import admin
from .models import Customer, Restaurant, Admin, UserAuth, RestaurantRequest

admin.site.register([Customer, Restaurant, Admin, UserAuth, RestaurantRequest])
