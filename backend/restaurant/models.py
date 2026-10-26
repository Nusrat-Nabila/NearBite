import os
from io import BytesIO

from django.core.files.base import ContentFile
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from PIL import Image, ImageOps

from account.models import Customer, Restaurant
from account.utils import generate_unique_slug


class DietaryTag(models.Model):
    name = models.CharField(max_length=200, unique=True)
    slug = models.SlugField(unique=True, blank=True, null=True)

    # Remember the name the tag was loaded with.
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._loaded_name = self.__dict__.get('name')

    # Rebuild the slug when it is missing or the name changed, then save.
    def save(self, *args, **kwargs):
        if not self.slug or self.name != self._loaded_name:
            self.slug = generate_unique_slug(self, self.name)
        super().save(*args, **kwargs)
        self._loaded_name = self.name
 
    # Show the tag's name.
    def __str__(self):
        return self.name
 
 
# Every cuisine picture is stored at this size, so they all look the same on the site.
CUISINE_IMAGE_SIZE = (520, 420)


class Cuisine(models.Model):
    name = models.CharField(max_length=200, unique=True)
    slug = models.SlugField(unique=True, blank=True, null=True)
    image = models.ImageField(upload_to='cuisine/', blank=True, null=True)

    # Remember the name the cuisine was loaded with.
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._loaded_name = self.__dict__.get('name')

    # Crop and resize the picture to the fixed size, as a JPEG.
    # A picture that is already that size is left alone.
    def resize_image(self):
        try:
            self.image.open()
            picture = Image.open(self.image)
            picture = ImageOps.exif_transpose(picture)
        except Exception:
            return  # not a picture Pillow can read: keep it as it is

        if picture.size == CUISINE_IMAGE_SIZE and self.image.name.lower().endswith('.jpg'):
            return

        if picture.mode in ('RGBA', 'LA', 'P'):
            picture = picture.convert('RGBA')
            background = Image.new('RGB', picture.size, (255, 255, 255))
            background.paste(picture, mask=picture.getchannel('A'))
            picture = background
        else:
            picture = picture.convert('RGB')

        picture = ImageOps.fit(picture, CUISINE_IMAGE_SIZE, Image.LANCZOS)

        buffer = BytesIO()
        picture.save(buffer, format='JPEG', quality=88)
        name = os.path.splitext(os.path.basename(self.image.name))[0] + '.jpg'
        self.image.save(name, ContentFile(buffer.getvalue()), save=False)

    # Rebuild the slug when it is missing or the name changed, resize the picture, then save.
    def save(self, *args, **kwargs):
        if not self.slug or self.name != self._loaded_name:
            self.slug = generate_unique_slug(self, self.name)
        if self.image:
            self.resize_image()
        super().save(*args, **kwargs)
        self._loaded_name = self.name
 
    # Show the cuisine's name.
    def __str__(self):
        return self.name
 
 
class FoodCategory(models.Model):
    name = models.CharField(max_length=200, unique=True)
    slug = models.SlugField(unique=True, blank=True, null=True)

    # Remember the name the category was loaded with.
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._loaded_name = self.__dict__.get('name')

    # Rebuild the slug when it is missing or the name changed, then save.
    def save(self, *args, **kwargs):
        if not self.slug or self.name != self._loaded_name:
            self.slug = generate_unique_slug(self, self.name)
        super().save(*args, **kwargs)
        self._loaded_name = self.name

    class Meta:
        verbose_name_plural = 'food categories'

    # Show the category's name.
    def __str__(self):
        return self.name


class MenuCategory(models.Model):
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name='menu_categories')
    name = models.CharField(max_length=200)
    display_order = models.IntegerField(blank=True, null=True)
 
    class Meta:
        ordering = ['display_order']
 
    # Show the menu category's name.
    def __str__(self):
        return f"{self.restaurant.name} - {self.name}"
 
 
class MenuItem(models.Model):
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name='menu_items')
    category = models.ForeignKey(MenuCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name='items')
    name = models.CharField(max_length=200)
    description = models.TextField(max_length=1000, blank=True, null=True)
    price = models.IntegerField(blank=True, null=True)
    old_price = models.IntegerField(blank=True, null=True)
    image = models.ImageField(upload_to='image/', blank=True, null=True)
    is_available = models.BooleanField(default=True)
    dietary_tags = models.ManyToManyField(DietaryTag, blank=True, related_name='menu_items')
    cuisines = models.ManyToManyField(Cuisine, blank=True, related_name='menu_items')
    food_categories = models.ManyToManyField(FoodCategory, blank=True, related_name='menu_items')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
 
    # Show the dish's name.
    def __str__(self):
        return self.name
    
class RestaurantMealType(models.Model):
    MEAL_CHOICES = (
        ('breakfast', 'Breakfast'),
        ('lunch', 'Lunch'),
        ('snacks', 'Snacks'),
        ('dinner', 'Dinner'),
    )

    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name='meal_types')
    meal_type = models.CharField(max_length=20, choices=MEAL_CHOICES)

    class Meta:
        ordering = ['id']
        constraints = [
            models.UniqueConstraint(fields=['restaurant', 'meal_type'], name='unique_restaurant_meal_type'),
            models.CheckConstraint(condition=models.Q(meal_type__in=['breakfast', 'lunch', 'snacks', 'dinner']), name='restaurant_meal_type_is_valid'),
        ]

    # Show the restaurant and its meal type.
    def __str__(self):
        return f"{self.restaurant.name} - {self.meal_type}"


class RestaurantOccasion(models.Model):
    OCCASION_CHOICES = (
        ('family', 'Family'),
        ('couples', 'Couples'),
        ('friends', 'Friends / Large Groups'),
        ('solo', 'Solo'),
    )

    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name='dining_occasions')
    occasion = models.CharField(max_length=20, choices=OCCASION_CHOICES)

    class Meta:
        ordering = ['id']
        constraints = [
            models.UniqueConstraint(fields=['restaurant', 'occasion'], name='unique_restaurant_occasion'),
            models.CheckConstraint(condition=models.Q(occasion__in=['family', 'couples', 'friends', 'solo']), name='restaurant_occasion_is_valid'),
        ]

    # Show the restaurant and its dining occasion.
    def __str__(self):
        return f"{self.restaurant.name} - {self.occasion}"


MEAL_TYPE_VALUES = [value for value, _ in RestaurantMealType.MEAL_CHOICES]
OCCASION_VALUES = [value for value, _ in RestaurantOccasion.OCCASION_CHOICES]


class OpeningHour(models.Model):
    DAY_CHOICES = (
        (0, 'Monday'),
        (1, 'Tuesday'),
        (2, 'Wednesday'),
        (3, 'Thursday'),
        (4, 'Friday'),
        (5, 'Saturday'),
        (6, 'Sunday'),
    )
 
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name='opening_hours')
    day_of_week = models.IntegerField(choices=DAY_CHOICES)
    open_time = models.TimeField(blank=True, null=True)
    close_time = models.TimeField(blank=True, null=True)
    is_closed = models.BooleanField(default=False)
 
    class Meta:
        unique_together = ('restaurant', 'day_of_week')
        ordering = ['day_of_week']
        constraints = [
            models.CheckConstraint(
                condition=models.Q(day_of_week__gte=0, day_of_week__lte=6),
                name='openinghour_day_is_0_to_6',
            ),
            models.CheckConstraint(
                condition=models.Q(is_closed=True) | (
                    models.Q(open_time__isnull=False)
                    & models.Q(close_time__isnull=False)
                    & ~models.Q(open_time=models.F('close_time'))
                ),
                name='openinghour_open_day_has_different_times',
            ),
        ]
 
    # Show the restaurant, day and opening times.
    def __str__(self):
        return f"{self.restaurant.name} - {self.get_day_of_week_display()}"
 
 
RATING_VALUES = [value / 2 for value in range(10, 0, -1)]


# Turn a rating into a JSON key, like 5 to "5" and 4.5 to "4.5".
def rating_key(rating):
    return str(int(rating)) if rating == int(rating) else str(rating)


class Review(models.Model):
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='reviews')
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name='reviews')
    rating = models.FloatField(validators=[MinValueValidator(0.5), MaxValueValidator(5)])
    comment = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
 
    class Meta:
        unique_together = ('customer', 'restaurant')
        constraints = [
            models.CheckConstraint(condition=models.Q(rating__in=RATING_VALUES), name='review_rating_is_half_star_step'),
        ]
 
    # Show who reviewed which restaurant.
    def __str__(self):
        return f"{self.customer.customer_name} - {self.restaurant.name} ({self.rating}/5)"
    
class DishReview(models.Model):
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='dish_reviews')
    menu_item = models.ForeignKey(MenuItem, on_delete=models.CASCADE, related_name='reviews')
    rating = models.FloatField(validators=[MinValueValidator(0.5), MaxValueValidator(5)])
    comment = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('customer', 'menu_item')
        constraints = [
            models.CheckConstraint(condition=models.Q(rating__in=RATING_VALUES), name='dishreview_rating_is_half_star_step'),
        ]

    # Show who reviewed which dish.
    def __str__(self):
        return f"{self.customer.customer_name} - {self.menu_item.name} ({self.rating}/5)"


class DailyDeals(models.Model):
    OFFER_TYPE_CHOICES = (
        ('percentage', 'Percentage Discount'),
        ('bogo', 'Buy One Get One'),
        ('combo', 'Combo Offer'),
        ('free_item', 'Free Item'),
        ('other', 'Other'),
    )
 
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name='daily_deals')
    deal_title = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    offer_type = models.CharField(max_length=20, choices=OFFER_TYPE_CHOICES, default='percentage')
    discount_percentage = models.PositiveSmallIntegerField(
        blank=True, null=True,
        validators=[MinValueValidator(1), MaxValueValidator(100)],
    )
    start_date = models.DateField(blank=True, null=True)
    end_date = models.DateField(blank=True, null=True)
    image = models.ImageField(upload_to='image/', blank=True, null=True)
    menu_items = models.ManyToManyField(MenuItem, blank=True, related_name='deals')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(discount_percentage__isnull=True) | models.Q(discount_percentage__gte=1, discount_percentage__lte=100),
                name='dailydeal_discount_1_to_100',
            ),
            models.CheckConstraint(
                condition=models.Q(start_date__isnull=True) | models.Q(end_date__isnull=True) | models.Q(end_date__gte=models.F('start_date')),
                name='dailydeal_end_not_before_start',
            ),
            models.CheckConstraint(
                condition=~models.Q(offer_type='percentage') | models.Q(discount_percentage__isnull=False),
                name='dailydeal_percentage_needs_discount',
            ),
        ]

    # Show the deal's title.
    def __str__(self):
        return f"{self.restaurant.name} - {self.deal_title}"

 
