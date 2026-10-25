from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
import logging
from django.core.mail import send_mail
from django.db import transaction
from django.conf import settings
from django.core import signing
from django.utils.crypto import salted_hmac
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Customer, Restaurant, Admin, UserAuth, RestaurantRequest
from .pagination import paginated_response
from .serializers import CustomerSerializer, RestaurantSerializer, AdminSerializer, RestaurantRequestSerializer

logger = logging.getLogger(__name__)


# Check whether the user is an admin.
def is_admin(user):
    return getattr(user, 'user_role', None) == "admin"


# Check the user has this role and email.
def is_owner(user, role, email):
    return getattr(user, 'user_role', None) == role and getattr(user, 'user_email', None) == email


# Return the 403 response for admin-only endpoints.
def admin_only_response():
    return Response({"success": False, "error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN)


# Return the 403 response for someone acting on another account.
def not_authorized_response():
    return Response({"success": False, "error": "Not authorized"}, status=status.HTTP_403_FORBIDDEN)


# Send an email without breaking the request if sending fails.
def send_status_mail(subject, message, to_email):
    try:
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [to_email], fail_silently=False)
    except Exception:
        logger.exception("Could not send email to %s", to_email)

# Keep the login record in step with the profile record.
def sync_user_auth(old_email, role, name, email, password):
    UserAuth.objects.filter(user_email=old_email, user_role=role).update(
        user_name=name,
        user_email=email,
        user_password=password,
    )
# Delete the login record that belongs to a profile.
def delete_user_auth(email, role):
    UserAuth.objects.filter(user_email=email, user_role=role).delete()
       
# Register a new customer account.
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def customer_signup(request):
    serializer = CustomerSerializer(data=request.data, context={'request': request})
    if serializer.is_valid():
        customer=serializer.save()

        UserAuth.objects.create(
        user_name=customer.customer_name,
        user_email=customer.customer_email,
        user_password=customer.customer_password,
        user_role=customer.customer_role
       )
  
        return Response({"success": True, "data": serializer.data}, status=status.HTTP_201_CREATED)
    else:
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# Submit a request to register a restaurant.
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def restaurant_request_signup(request):
    email = request.data.get('restaurant_email')
    if not email:
        return Response(
            {"success": False, "error": "Email is required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    existing = RestaurantRequest.objects.filter(restaurant_email=email).first()
    if existing:
        still_blocking = existing.status == "pending" or (
            existing.status == "approved" and Restaurant.objects.filter(email=email).exists()
        )
        if still_blocking:
            return Response(
                {"success": False, "error": "A request with this email already exists."},
                status=status.HTTP_400_BAD_REQUEST
            )

    serializer = RestaurantRequestSerializer(existing, data=request.data)
    if serializer.is_valid():
        serializer.save(status="pending", decline_reason=None)
        return Response({
            "success": True,
            "message": "Request submitted. Awaiting admin approval."
        }, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# List restaurant signup requests for the admin.
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_restaurant_request(request):
    if not is_admin(request.user):
        return admin_only_response()
    requests = RestaurantRequest.objects.all().order_by('-created_at', '-id')
    return paginated_response(request, requests, lambda rows: RestaurantRequestSerializer(rows, many=True).data)


# Show the details of one restaurant signup request.
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def requested_restaurant_info(request, request_id):
    if not is_admin(request.user):
        return admin_only_response()
    restaurant_req = get_object_or_404(RestaurantRequest, id=request_id)
    serializer = RestaurantRequestSerializer(restaurant_req)
    return Response(serializer.data, status=status.HTTP_200_OK)


# Approve or decline a restaurant signup request.
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def process_restaurant_request(request, request_id):
    if not is_admin(request.user):
        return admin_only_response()

    action = request.data.get("action")
    restaurant_req = get_object_or_404(RestaurantRequest, id=request_id)

    if restaurant_req.status != "pending":
        return Response(
            {"success": False, "error": f"Request is already {restaurant_req.status}"},
            status=status.HTTP_400_BAD_REQUEST
        )

    if action == "approve":
        if Restaurant.objects.filter(email=restaurant_req.restaurant_email).exists():
            return Response(
                {"success": False, "error": "A restaurant with this email already exists."},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            restaurant = Restaurant.objects.create(
                name=restaurant_req.restaurant_name,
                email=restaurant_req.restaurant_email,
                phone_no=restaurant_req.restaurant_phone,
                business_reg_id=restaurant_req.restaurant_business_reg_id,
                owner_name=restaurant_req.restaurant_owner_name,
                city=restaurant_req.restaurant_city,
                area=restaurant_req.restaurant_area,
                location=restaurant_req.restaurant_location,
                password=restaurant_req.restaurant_password,
            )

            UserAuth.objects.create(
                user_name=restaurant.name,
                user_email=restaurant.email,
                user_password=restaurant.password,
                user_role="restaurant",
            )

            restaurant_req.status = "approved"
            restaurant_req.save()

        send_status_mail(
            "Restaurant Request Approved",
            "Congratulations! Your restaurant registration request has been approved. You can now log in.",
            restaurant_req.restaurant_email,
        )

        return Response({"success": True, "message": "Request approved and restaurant created."}, status=status.HTTP_200_OK)

    elif action == "decline":
        reason = (request.data.get("reason") or "").strip()
        if not reason:
            return Response(
                {"success": False, "error": "A reason is required when declining a request"},
                status=status.HTTP_400_BAD_REQUEST
            )

        restaurant_req.status = "declined"
        restaurant_req.decline_reason = reason
        restaurant_req.save()

        message = (
            f"Hi {restaurant_req.restaurant_name},"
            "\n\n"
            "Sorry, your restaurant registration request has been declined."
            "\n\n"
            f"Reason: {reason}"
            "\n\n"
            "You can fix the issue and apply again at any time:"
            "\n"
            f"{settings.FRONTEND_URL}/register/owner"
        )
        send_status_mail("Restaurant Request Declined", message, restaurant_req.restaurant_email)

        return Response({"success": True, "message": "Request declined."}, status=status.HTTP_200_OK)

    return Response({"success": False, "error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)


# Log in any role and return its tokens.
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def login(request):
    role = request.data.get('role')
    email = request.data.get('email')
    password = request.data.get('password')

    if not email or not password or not role:
        return Response({"success": False, "error": "Email, password, and role are required"}, status=status.HTTP_400_BAD_REQUEST)

    user_auth = UserAuth.objects.filter(user_email=email, user_role=role).first()
    if not user_auth:
        return Response({"success": False, "error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    if user_auth.user_password != password:
        return Response({"success": False, "error": "Incorrect password"}, status=status.HTTP_401_UNAUTHORIZED)

    if role == "customer":
        user = get_object_or_404(Customer, customer_email=email)
        serializer = CustomerSerializer(user, context={'request': request})
    elif role == "restaurant":
        user = get_object_or_404(Restaurant, email=email)
        serializer = RestaurantSerializer(user, context={'request': request})
    elif role == "admin":
        user = get_object_or_404(Admin, admin_email=email)
        serializer = AdminSerializer(user)
    else:
        return Response({"success": False, "error": "Invalid role"}, status=status.HTTP_400_BAD_REQUEST)

    refresh = RefreshToken()
    refresh['user_id'] = user_auth.id
    refresh['email'] = user_auth.user_email
    refresh['role'] = user_auth.user_role
    

    return Response({
        "success": True,
        "role": user_auth.user_role,
        "data": serializer.data,
        "access_token": str(refresh.access_token),
        "refresh_token": str(refresh),
    }, status=status.HTTP_200_OK)


RESET_SALT = "nearbite-password-reset"
RESET_TOKEN_MAX_AGE = 60 * 60
MIN_PASSWORD_LENGTH = 8

PROFILE_PASSWORD_FIELDS = {
    "customer": (Customer, "customer_email", "customer_password"),
    "restaurant": (Restaurant, "email", "password"),
    "admin": (Admin, "admin_email", "admin_password"),
}


# Make a value from the password so a reset link works only once.
def password_fingerprint(user_auth):
    return salted_hmac(RESET_SALT, user_auth.user_password or "").hexdigest()


# Email a password reset link.
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def forgot_password(request):
    email = request.data.get('email')
    role = request.data.get('role')

    if not email or not role:
        return Response({"success": False, "error": "Email and role are required"}, status=status.HTTP_400_BAD_REQUEST)
    if not isinstance(email, str) or not isinstance(role, str):
        return Response({"success": False, "error": "Email and role must be text"}, status=status.HTTP_400_BAD_REQUEST)
    if role not in PROFILE_PASSWORD_FIELDS:
        return Response({"success": False, "error": "Invalid role"}, status=status.HTTP_400_BAD_REQUEST)

    user_auth = UserAuth.objects.filter(user_email=email, user_role=role).first()
    if user_auth:
        token = signing.dumps({"uid": user_auth.id, "fp": password_fingerprint(user_auth)}, salt=RESET_SALT)
        link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        message = (
            f"Hi {user_auth.user_name or ''},"
            "\n\n"
            "Use the link below to choose a new password. It works once and expires in 1 hour."
            "\n\n"
            f"{link}"
            "\n\n"
            "If you did not ask for this, you can ignore this email."
        )
        send_status_mail("Reset your NearBite password", message, user_auth.user_email)

    return Response(
        {"success": True, "message": "If an account with that email exists, a reset link has been sent."},
        status=status.HTTP_200_OK
    )


# Set a new password from a reset link.
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def reset_password(request):
    token = request.data.get('token')
    new_password = request.data.get('new_password')
    confirm_password = request.data.get('confirm_password')

    if not token or not new_password or not confirm_password:
        return Response(
            {"success": False, "error": "Token, new password and confirm password are required"},
            status=status.HTTP_400_BAD_REQUEST
        )
    if not all(isinstance(value, str) for value in (token, new_password, confirm_password)):
        return Response({"success": False, "error": "Token, new password and confirm password must be text"}, status=status.HTTP_400_BAD_REQUEST)
    if new_password != confirm_password:
        return Response({"success": False, "error": "Passwords do not match"}, status=status.HTTP_400_BAD_REQUEST)
    if len(new_password) < MIN_PASSWORD_LENGTH:
        return Response(
            {"success": False, "error": f"Password must be at least {MIN_PASSWORD_LENGTH} characters"},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        data = signing.loads(token, salt=RESET_SALT, max_age=RESET_TOKEN_MAX_AGE)
    except signing.BadSignature:
        return Response({"success": False, "error": "This reset link is invalid or has expired"}, status=status.HTTP_400_BAD_REQUEST)

    user_auth = UserAuth.objects.filter(id=data.get("uid")).first()
    if not user_auth or data.get("fp") != password_fingerprint(user_auth):
        return Response({"success": False, "error": "This reset link is invalid or has already been used"}, status=status.HTTP_400_BAD_REQUEST)

    model, email_field, password_field = PROFILE_PASSWORD_FIELDS[user_auth.user_role]
    with transaction.atomic():
        user_auth.user_password = new_password
        user_auth.save()
        model.objects.filter(**{email_field: user_auth.user_email}).update(**{password_field: new_password})

    return Response({"success": True, "message": "Password updated. You can now log in."}, status=status.HTTP_200_OK)
