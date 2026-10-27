from django.core.validators import FileExtensionValidator
from rest_framework import serializers
from rest_framework.reverse import reverse
from .models import Customer, Restaurant, Admin, RestaurantRequest, DOCUMENT_FIELDS

MAX_DOCUMENT_BYTES = 2 * 1024 * 1024


# Make sure an uploaded document is a real PDF that is not too big.
def validate_pdf(upload):
    if upload.size > MAX_DOCUMENT_BYTES:
        raise serializers.ValidationError("Each document must be 2 MB or smaller.")
    head = upload.read(5)
    upload.seek(0)
    if head != b'%PDF-':
        raise serializers.ValidationError("Upload a valid PDF file.")


# Build a required PDF upload field for the signup form.
def pdf_field():
    return serializers.FileField(write_only=True, validators=[FileExtensionValidator(['pdf']), validate_pdf])


class RestaurantDocumentUploadSerializer(serializers.Serializer):
    tin_certificate = serializers.FileField(required=False, validators=[FileExtensionValidator(['pdf']), validate_pdf])
    vat_certificate = serializers.FileField(required=False, validators=[FileExtensionValidator(['pdf']), validate_pdf])
    trade_license = serializers.FileField(required=False, validators=[FileExtensionValidator(['pdf']), validate_pdf])
    restaurant_license = serializers.FileField(required=False, validators=[FileExtensionValidator(['pdf']), validate_pdf])


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
            'account_status',
            'status_reason',
            'scheduled_deletion_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['customer_role', 'account_status', 'status_reason', 'scheduled_deletion_at', 'created_at', 'updated_at']
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
            'account_status',
            'scheduled_deletion_at',
            'created_at',
            'updated_at',
            'slug',
        ]
        read_only_fields = ['slug', 'account_status', 'scheduled_deletion_at', 'created_at', 'updated_at']
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
    tin_certificate = pdf_field()
    vat_certificate = pdf_field()
    trade_license = pdf_field()
    restaurant_license = pdf_field()
    documents = serializers.SerializerMethodField()

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
            *DOCUMENT_FIELDS,
            'documents',
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

    # Give the admin the private links of the uploaded documents.
    def get_documents(self, obj):
        request = self.context.get('request')
        links = {}
        for kind in DOCUMENT_FIELDS:
            if getattr(obj, kind):
                links[kind] = reverse('request_document', args=[obj.id, kind], request=request)
        return links

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
