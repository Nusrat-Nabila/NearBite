from django.utils import timezone
from rest_framework import serializers
from .deals import best_item_deals, deal_status, item_pricing
from .models import DietaryTag, Cuisine, FoodCategory, MenuCategory, MenuItem, OpeningHour, DailyDeals


class DietaryTagSerializer(serializers.ModelSerializer):

    class Meta:
        model = DietaryTag
        fields = [
            'id',
            'name',
            'slug',
        ]
        read_only_fields = ['slug']


class CuisineSerializer(serializers.ModelSerializer):

    class Meta:
        model = Cuisine
        fields = [
            'id',
            'name',
            'slug',
            'image',
        ]
        read_only_fields = ['slug']


class FoodCategorySerializer(serializers.ModelSerializer):

    class Meta:
        model = FoodCategory
        fields = [
            'id',
            'name',
            'slug',
        ]
        read_only_fields = ['slug']


class MenuCategorySerializer(serializers.ModelSerializer):

    class Meta:
        model = MenuCategory
        fields = [
            'id',
            'restaurant',
            'name',
            'display_order',
        ]
        read_only_fields = ['restaurant']
        extra_kwargs = {
            'display_order': {'min_value': 0},
        }

    # Reject a menu category name the restaurant already uses.
    def validate_name(self, value):
        restaurant = self.context.get('restaurant')
        if restaurant is not None:
            clash = MenuCategory.objects.filter(restaurant=restaurant, name__iexact=value)
            if self.instance is not None:
                clash = clash.exclude(pk=self.instance.pk)
            if clash.exists():
                raise serializers.ValidationError("You already have a category with this name")
        return value


class DishPricingMixin(serializers.Serializer):
    original_price = serializers.SerializerMethodField()
    final_price = serializers.SerializerMethodField()
    discount_percent = serializers.SerializerMethodField()
    discount_source = serializers.SerializerMethodField()
    deal = serializers.SerializerMethodField()

    # Work out the dish's price details once and reuse them.
    def _pricing(self, obj):
        cache = self.__dict__.setdefault('_pricing_cache', {})
        if obj.pk not in cache:
            deals = self.context.get('item_deals')
            if deals is None:
                deals = best_item_deals([obj.pk], timezone.localdate())
            deal = deals.get(obj.pk)
            cache[obj.pk] = (item_pricing(obj, deal), deal)
        return cache[obj.pk]

    # Return the price before any discount.
    def get_original_price(self, obj):
        return self._pricing(obj)[0]['original_price']

    # Return the price after any discount.
    def get_final_price(self, obj):
        return self._pricing(obj)[0]['final_price']

    # Return the discount percentage.
    def get_discount_percent(self, obj):
        return self._pricing(obj)[0]['discount_percent']

    # Return where the discount comes from.
    def get_discount_source(self, obj):
        return self._pricing(obj)[0]['discount_source']

    # Return the offer applied to the dish.
    def get_deal(self, obj):
        deal = self._pricing(obj)[1]
        return {'id': deal['id'], 'title': deal['title'], 'offer_type': deal['offer_type']} if deal else None


class MenuItemSerializer(serializers.ModelSerializer):
    dietary_tags = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=DietaryTag.objects.all(),
        required=False
    )
    cuisines = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Cuisine.objects.all(),
        required=False
    )
    food_categories = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=FoodCategory.objects.all(),
        required=False
    )

    class Meta:
        model = MenuItem
        fields = [
            'id',
            'restaurant',
            'category',
            'name',
            'description',
            'price',
            'old_price',
            'image',
            'is_available',
            'dietary_tags',
            'cuisines',
            'food_categories',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['restaurant', 'created_at', 'updated_at']
        extra_kwargs = {
            'price': {'required': True, 'allow_null': False, 'min_value': 0},
            'old_price': {'min_value': 0},
        }

    # Check the dish fields together before saving.
    def validate(self, data):
        # Read a field from the new data or the existing dish.
        def value(name):
            if name in data:
                return data[name]
            return getattr(self.instance, name) if self.instance is not None else None

        old_price, price = value('old_price'), value('price')
        if old_price is not None and price is not None and old_price <= price:
            raise serializers.ValidationError({"old_price": "The old price must be higher than the price"})
        return data

    # Make sure the category belongs to this restaurant.
    def validate_category(self, value):
        if value is None:
            return value
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if (
            getattr(user, 'user_role', None) != 'restaurant'
            or getattr(user, 'user_email', None) != value.restaurant.email
        ):
            raise serializers.ValidationError("You can only use your own menu categories")
        return value


class MenuItemDetailSerializer(DishPricingMixin, serializers.ModelSerializer):
    dietary_tags = DietaryTagSerializer(many=True, read_only=True)
    cuisines = CuisineSerializer(many=True, read_only=True)
    food_categories = FoodCategorySerializer(many=True, read_only=True)

    class Meta:
        model = MenuItem
        fields = [
            'id',
            'restaurant',
            'category',
            'name',
            'description',
            'price',
            'old_price',
            'original_price',
            'final_price',
            'discount_percent',
            'discount_source',
            'deal',
            'image',
            'is_available',
            'dietary_tags',
            'cuisines',
            'food_categories',
            'created_at',
            'updated_at',
        ]


class OpeningHourSerializer(serializers.ModelSerializer):
    day_name = serializers.CharField(source='get_day_of_week_display', read_only=True)

    class Meta:
        model = OpeningHour
        fields = [
            'id',
            'restaurant',
            'day_of_week',
            'day_name',
            'open_time',
            'close_time',
            'is_closed',
        ]
        read_only_fields = ['restaurant']

    # Check the opening and closing times.
    def validate(self, data):
        is_closed = data.get("is_closed", False)
        open_time = data.get("open_time")
        close_time = data.get("close_time")

        if is_closed:
            data["open_time"] = None
            data["close_time"] = None
            return data

        if open_time is None or close_time is None:
            raise serializers.ValidationError("Open time and close time are required when the restaurant is open")
        if open_time == close_time:
            raise serializers.ValidationError("Open time and close time cannot be the same")
        return data


class DailyDealsSerializer(serializers.ModelSerializer):
    status = serializers.SerializerMethodField()
    menu_items = serializers.PrimaryKeyRelatedField(many=True, queryset=MenuItem.objects.all(), required=False)

    class Meta:
        model = DailyDeals
        fields = [
            'id',
            'restaurant',
            'deal_title',
            'description',
            'offer_type',
            'discount_percentage',
            'start_date',
            'end_date',
            'image',
            'menu_items',
            'is_active',
            'status',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['restaurant', 'status', 'created_at', 'updated_at']

    # Return the deal's status.
    def get_status(self, obj):
        return deal_status(obj, timezone.localdate())

    # Make sure the dishes belong to this restaurant.
    def validate_menu_items(self, items):
        restaurant = self.context.get('restaurant')
        if restaurant is not None and any(item.restaurant_id != restaurant.id for item in items):
            raise serializers.ValidationError("You can only put your own dishes on an offer")
        return items

    # Check the deal fields together before saving.
    def validate(self, data):
        current = self.instance

        # Read a field from the new data or the existing deal.
        def value(name, default=None):
            if name in data:
                return data[name]
            return getattr(current, name) if current is not None else default

        offer_type = value('offer_type', 'percentage')
        discount = value('discount_percentage')
        start, end = value('start_date'), value('end_date')

        if offer_type == 'percentage' and discount is None:
            raise serializers.ValidationError({"discount_percentage": "A percentage offer needs a discount between 1 and 100"})
        if start and end and end < start:
            raise serializers.ValidationError({"end_date": "End date cannot be before start date"})
        if current is None and end and end < timezone.localdate():
            raise serializers.ValidationError({"end_date": "The end date has already passed"})
        return data


class DailyDealCardSerializer(serializers.ModelSerializer):
    offer_type_label = serializers.CharField(source='get_offer_type_display', read_only=True)
    restaurant = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()
    items = serializers.SerializerMethodField()

    class Meta:
        model = DailyDeals
        fields = [
            'id',
            'deal_title',
            'description',
            'offer_type',
            'offer_type_label',
            'discount_percentage',
            'image',
            'start_date',
            'end_date',
            'restaurant',
            'items',
        ]

    # List the deal's dishes with their price before and after the deal.
    def get_items(self, obj):
        deal = {'id': obj.id, 'title': obj.deal_title, 'offer_type': obj.offer_type, 'pct': obj.discount_percentage}
        request = self.context.get('request')
        items = []
        for dish in sorted(obj.menu_items.all(), key=lambda d: d.name.lower()):
            pricing = item_pricing(dish, deal)
            on_offer = pricing['discount_source'] == 'offer'
            items.append({
                'id': dish.id,
                'name': dish.name,
                'image': (request.build_absolute_uri(dish.image.url) if request else dish.image.url) if dish.image else None,
                'is_available': dish.is_available,
                'original_price': pricing['original_price'] if on_offer else None,
                'final_price': pricing['final_price'] if on_offer else dish.price,
                'discount_percent': pricing['discount_percent'] if on_offer else None,
            })
        return items

    # Return the restaurant that runs the deal.
    def get_restaurant(self, obj):
        r = obj.restaurant
        return {'id': r.id, 'name': r.name, 'area': r.area, 'city': r.city}

    # Return the deal's image URL.
    def get_image(self, obj):
        picture = obj.image or obj.restaurant.cover_image or obj.restaurant.logo
        if not picture:
            return None
        request = self.context.get('request')
        return request.build_absolute_uri(picture.url) if request else picture.url
