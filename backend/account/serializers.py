from rest_framework import serializers
from .models import Customer, Restaurant, Admin, RestaurantRequest


class CustomerSerializer(serializers.ModelSerializer):

    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        model = Customer
        fields = [
            'id',
            'customer_name',
            'customer_email',
            'customer_phone',
            'customer_city',
            'customer_area',
            'customer_address',
            'customer_image',
            'customer_password',
            'confirm_password',
            'customer_role',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['customer_role', 'created_at', 'updated_at']
        extra_kwargs = {
            'customer_email': {'required': True, 'allow_null': False},
            'customer_password': {'write_only': True, 'required': True, 'allow_null': False, 'allow_blank': False},
        }

    # Check the customer fields together before saving.
    def validate(self, data):
        password = data.get("customer_password")
        confirm = data.get("confirm_password")

        if password != confirm:
            raise serializers.ValidationError("Passwords do not match")
        else:
            data.pop("confirm_password", None)
        return data


class RestaurantSerializer(serializers.ModelSerializer):

    class Meta:
        model = Restaurant
        fields = [
            'id',
            'name',
            'description',
            'min_price',
            'max_price',
            'city',
            'area',
            'location',
            'latitude',
            'longitude',
            'email',
            'phone_no',
            'business_reg_id',
            'owner_name',
            'logo',
            'cover_image',
            'password',
            'is_temporarily_closed',
            'created_at',
            'updated_at',
            'slug',
        ]
        read_only_fields = ['slug', 'created_at', 'updated_at']
        extra_kwargs = {
            'email': {'required': True, 'allow_null': False},
            'password': {'write_only': True, 'required': True, 'allow_null': False, 'allow_blank': False},
        }

    # Check the restaurant fields together before saving.
    def validate(self, data):
        latitude = data.get('latitude', self.instance.latitude if self.instance else None)
        longitude = data.get('longitude', self.instance.longitude if self.instance else None)
        if latitude is not None and not -90 <= latitude <= 90:
            raise serializers.ValidationError({"latitude": "Latitude must be between -90 and 90"})
        if longitude is not None and not -180 <= longitude <= 180:
            raise serializers.ValidationError({"longitude": "Longitude must be between -180 and 180"})
        if (latitude is None) != (longitude is None):
            raise serializers.ValidationError("Send both latitude and longitude, or neither")
        return data


class AdminSerializer(serializers.ModelSerializer):

    class Meta:
        model = Admin
        fields = [
            'id',
            'admin_name',
            'admin_email',
            'admin_password',
            'admin_role',
        ]
        read_only_fields = ['admin_role']
        extra_kwargs = {
            'admin_email': {'required': True, 'allow_null': False},
            'admin_password': {'write_only': True, 'required': True, 'allow_null': False, 'allow_blank': False},
        }


class RestaurantRequestSerializer(serializers.ModelSerializer):

    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        model = RestaurantRequest
        fields = [
            'id',
            'restaurant_name',
            'restaurant_email',
            'restaurant_phone',
            'restaurant_business_reg_id',
            'restaurant_owner_name',
            'restaurant_city',
            'restaurant_area',
            'restaurant_location',
            'restaurant_password',
            'confirm_password',
            'status',
            'decline_reason',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['status', 'decline_reason', 'created_at', 'updated_at']
        extra_kwargs = {
            'restaurant_email': {'required': True, 'allow_null': False},
            'restaurant_password': {'write_only': True, 'required': True, 'allow_null': False, 'allow_blank': False},
        }

    # Make sure the restaurant email is not already in use.
    def validate_restaurant_email(self, value):
        if Restaurant.objects.filter(email=value).exists():
            raise serializers.ValidationError("A restaurant with this email already exists.")
        return value

    # Check the signup request fields together.
    def validate(self, data):
        password = data.get("restaurant_password")
        confirm = data.get("confirm_password")

        if password != confirm:
            raise serializers.ValidationError("Passwords do not match")
        else:
            data.pop("confirm_password", None)
        return data
