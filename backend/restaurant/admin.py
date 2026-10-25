from django.contrib import admin
from .models import DietaryTag, Cuisine, FoodCategory, MenuCategory, MenuItem, OpeningHour, Review, DailyDeals

admin.site.register([DietaryTag, Cuisine, FoodCategory, MenuCategory, MenuItem, OpeningHour, Review, DailyDeals])
