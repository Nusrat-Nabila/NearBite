from rest_framework import serializers
from restaurant.serializers import DietaryTagSerializer, CuisineSerializer, FoodCategorySerializer
from .models import RestaurantReport


class UniqueNameMixin:

    # Reject a name that already exists, ignoring case.
    def validate_name(self, value):
        clash = self.Meta.model.objects.filter(name__iexact=value)
        if self.instance is not None:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError("This name already exists")
        return value


class DietaryTagAdminSerializer(UniqueNameMixin, DietaryTagSerializer):
    menu_item_count = serializers.SerializerMethodField()

    class Meta(DietaryTagSerializer.Meta):
        fields = DietaryTagSerializer.Meta.fields + ['menu_item_count']

    # Count the dishes that use this tag.
    def get_menu_item_count(self, obj):
        return obj.menu_items.count()


class CuisineAdminSerializer(UniqueNameMixin, CuisineSerializer):
    menu_item_count = serializers.SerializerMethodField()

    class Meta(CuisineSerializer.Meta):
        fields = CuisineSerializer.Meta.fields + ['menu_item_count']

    # Count the dishes that use this cuisine.
    def get_menu_item_count(self, obj):
        return obj.menu_items.count()


class FoodCategoryAdminSerializer(UniqueNameMixin, FoodCategorySerializer):
    menu_item_count = serializers.SerializerMethodField()

    class Meta(FoodCategorySerializer.Meta):
        fields = FoodCategorySerializer.Meta.fields + ['menu_item_count']

    # Count the dishes that use this food category.
    def get_menu_item_count(self, obj):
        return obj.menu_items.count()


class RestaurantReportAdminSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.customer_name', read_only=True)
    customer_email = serializers.CharField(source='customer.customer_email', read_only=True)
    restaurant_name = serializers.CharField(source='restaurant.name', read_only=True)

    class Meta:
        model = RestaurantReport
        fields = [
            'id',
            'customer',
            'customer_name',
            'customer_email',
            'restaurant',
            'restaurant_name',
            'description',
            'status',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [f for f in fields if f != 'status']
