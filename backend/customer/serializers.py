from rest_framework import serializers
from restaurant.models import MenuItem
from restaurant.serializers import CuisineSerializer, DietaryTagSerializer, DishPricingMixin, FoodCategorySerializer


class DishSerializer(DishPricingMixin, serializers.ModelSerializer):
    availability = serializers.SerializerMethodField()
    dietary_tags = DietaryTagSerializer(many=True, read_only=True)
    cuisines = CuisineSerializer(many=True, read_only=True)
    food_categories = FoodCategorySerializer(many=True, read_only=True)

    class Meta:
        model = MenuItem
        fields = [
            'id',
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
            'availability',
            'dietary_tags',
            'cuisines',
            'food_categories',
        ]
        read_only_fields = fields

    # Describe whether the dish is in stock.
    def get_availability(self, obj):
        return 'available' if obj.is_available else 'out_of_stock'
