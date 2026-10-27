from datetime import timedelta
from django.http import FileResponse, Http404
from django.utils import timezone
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
from rest_framework.reverse import reverse
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Customer, Restaurant, Admin, UserAuth, RestaurantRequest, DOCUMENT_FIELDS
from .status import blocked_profile, blocked_message, find_profile
from .pagination import paginated_response
from .serializers import CustomerSerializer, RestaurantSerializer, AdminSerializer, RestaurantRequestSerializer, RestaurantDocumentUploadSerializer

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

    serializer = RestaurantRequestSerializer(existing, data=request.data, context={'request': request})
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
    return paginated_response(request, requests, lambda rows: RestaurantRequestSerializer(rows, many=True, context={'request': request}).data)


# Show the details of one restaurant signup request.
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def requested_restaurant_info(request, request_id):
    if not is_admin(request.user):
        return admin_only_response()
    restaurant_req = get_object_or_404(RestaurantRequest, id=request_id)
    serializer = RestaurantRequestSerializer(restaurant_req, context={'request': request})
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
                **{kind: getattr(restaurant_req, kind).name for kind in DOCUMENT_FIELDS},
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


# Send a private document file to the admin who asked for it.
def document_response(owner, kind):
    if kind not in DOCUMENT_FIELDS:
        raise Http404("Unknown document")
    field = getattr(owner, kind)
    if not field:
        raise Http404("Document not uploaded")
    try:
        return FileResponse(field.open('rb'), content_type='application/pdf', filename=f"{kind}.pdf")
    except FileNotFoundError:
        raise Http404("Document file is missing")


# Let the admin open a document of a restaurant signup request.
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def request_document(request, request_id, kind):
    if not is_admin(request.user):
        return admin_only_response()
    return document_response(get_object_or_404(RestaurantRequest, id=request_id), kind)


# Check the user is an admin or the owner of this restaurant.
def can_see_restaurant_documents(user, restaurant):
    return is_admin(user) or is_owner(user, "restaurant", restaurant.email)


# Let the admin or the restaurant's own owner open one of its documents.
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def restaurant_document(request, restaurant_id, kind):
    restaurant = get_object_or_404(Restaurant, id=restaurant_id)
    if not can_see_restaurant_documents(request.user, restaurant):
        return not_authorized_response()
    return document_response(restaurant, kind)


# Let a restaurant owner upload the documents that are still missing on their profile.
# A document that is already uploaded cannot be replaced, so approved papers stay as the admin saw them.
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_restaurant_documents(request, restaurant_id):
    restaurant = get_object_or_404(Restaurant, id=restaurant_id)
    if not is_owner(request.user, "restaurant", restaurant.email):
        return not_authorized_response()

    serializer = RestaurantDocumentUploadSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    files = serializer.validated_data
    if not files:
        return Response({"success": False, "error": "Choose at least one PDF to upload"}, status=status.HTTP_400_BAD_REQUEST)

    already = [kind for kind in files if getattr(restaurant, kind)]
    if already:
        return Response(
            {"success": False, "error": f"Already uploaded: {', '.join(already)}. An uploaded document cannot be replaced."},
            status=status.HTTP_400_BAD_REQUEST
        )

    for kind, upload in files.items():
        setattr(restaurant, kind, upload)
    restaurant.save(update_fields=[*files, "updated_at"])
    return Response({"success": True, "message": "Documents uploaded."}, status=status.HTTP_200_OK)


# List the links of the documents a restaurant uploaded, for the admin or the owner.
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def restaurant_documents(request, restaurant_id):
    restaurant = get_object_or_404(Restaurant, id=restaurant_id)
    if not can_see_restaurant_documents(request.user, restaurant):
        return not_authorized_response()
    links = {
        kind: reverse('restaurant_document', args=[restaurant.id, kind], request=request)
        for kind in DOCUMENT_FIELDS
        if getattr(restaurant, kind)
    }
    return Response({"documents": links}, status=status.HTTP_200_OK)


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

    pending = find_profile(role, email)
    if pending and pending.account_status == "pending_deletion":
        pending.account_status = "active"
        pending.status_reason = None
        pending.scheduled_deletion_at = None
        pending.save(update_fields=["account_status", "status_reason", "scheduled_deletion_at", "updated_at"])
        send_deletion_cancelled_mail(user_auth.user_name, email)

    blocked = blocked_profile(user_auth)
    if blocked:
        return Response(
            {"success": False, "error": blocked_message(blocked), "account_status": blocked.account_status},
            status=status.HTTP_403_FORBIDDEN
        )

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


DELETION_GRACE_DAYS = 30

ACCOUNT_STATUS_MODELS = {
    "customer": (Customer, "customer_email", "customer_name"),
    "restaurant": (Restaurant, "email", "name"),
}

STATUS_MAIL_SUBJECTS = {
    "suspended": "Your NearBite account has been suspended",
    "active": "Your NearBite account is active again",
}


# Email someone that an admin changed the status of their account.
def send_account_status_mail(name, email, new_status, reason):
    if new_status == "active":
        message = (
            f"Hi {name},"
            "\n\n"
            "Good news: your NearBite account has been activated again. You can log in as usual:"
            "\n"
            f"{settings.FRONTEND_URL}/login"
            "\n\n"
            "The NearBite Team"
        )
    else:
        message = (
            f"Hi {name},"
            "\n\n"
            "Your account has been suspended."
            "\n\n"
            f"Reason: {reason}"
            "\n\n"
            "A suspended account will not be reactivated automatically. If you think this is a mistake "
            "and you want this account reactivated, reply to this email or send an email to contact the admin."
            "\n\n"
            "The NearBite Team"
        )
    send_status_mail(STATUS_MAIL_SUBJECTS[new_status], message, email)


# Let the admin suspend, disable or re-activate a customer or restaurant account.
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def set_account_status(request, role, account_id):
    if not is_admin(request.user):
        return admin_only_response()
    if role not in ACCOUNT_STATUS_MODELS:
        return Response({"success": False, "error": "Role must be customer or restaurant"}, status=status.HTTP_400_BAD_REQUEST)

    new_status = request.data.get("status")
    reason = request.data.get("reason")
    if new_status not in STATUS_MAIL_SUBJECTS:
        return Response({"success": False, "error": "Status must be active or suspended"}, status=status.HTTP_400_BAD_REQUEST)
    if reason is not None and not isinstance(reason, str):
        return Response({"success": False, "error": "Reason must be text"}, status=status.HTTP_400_BAD_REQUEST)
    reason = (reason or "").strip()
    if new_status != "active" and not reason:
        return Response({"success": False, "error": "A reason is required to suspend an account"}, status=status.HTTP_400_BAD_REQUEST)

    model, email_field, name_field = ACCOUNT_STATUS_MODELS[role]
    account = get_object_or_404(model, id=account_id)
    account.account_status = new_status
    account.status_reason = None if new_status == "active" else reason
    if new_status == "active":
        account.scheduled_deletion_at = None
    elif account.scheduled_deletion_at:
        return Response(
            {"success": False, "error": "This account is already scheduled for deletion. Activate it to cancel the deletion."},
            status=status.HTTP_400_BAD_REQUEST
        )
    account.save(update_fields=["account_status", "status_reason", "scheduled_deletion_at", "updated_at"])

    email = getattr(account, email_field)
    if email:
        send_account_status_mail(getattr(account, name_field), email, new_status, reason)

    return Response(
        {"success": True, "message": f"Account is now {new_status}.", "account_status": new_status},
        status=status.HTTP_200_OK
    )


# Email someone that their account is deleted (the final notice, after the 30 days).
def send_account_deleted_mail(name, email, reason):
    message = (
        f"Hi {name},"
        "\n\n"
        "Your NearBite account has now been permanently deleted."
        "\n\n"
        f"Reason: {reason}"
        "\n\n"
        "The NearBite Team"
    )
    send_status_mail("Your NearBite account has been deleted", message, email)


# Email someone that their account will be deleted in 30 days and is suspended until then.
def send_deletion_scheduled_mail(name, email, reason, delete_on):
    message = (
        f"Hi {name},"
        "\n\n"
        f"Your account will be permanently deleted within 30 days, on {delete_on:%d %b %Y}. "
        "Until then it is suspended."
        "\n\n"
        f"Reason: {reason}"
        "\n\n"
        "A deleted account cannot be activated again. If you think this is a mistake, "
        "reply to this email within 30 days to contact the admin."
        "\n\n"
        "The NearBite Team"
    )
    send_status_mail("Your NearBite account will be deleted in 30 days", message, email)


# Let the admin schedule a customer or restaurant account for deletion in 30 days.
# The account is suspended until then, and the admin can still activate it to cancel the deletion.
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_delete_account(request, role, account_id):
    if not is_admin(request.user):
        return admin_only_response()
    if role not in ACCOUNT_STATUS_MODELS:
        return Response({"success": False, "error": "Role must be customer or restaurant"}, status=status.HTTP_400_BAD_REQUEST)

    reason = request.data.get("reason")
    if not isinstance(reason, str) or not reason.strip():
        return Response({"success": False, "error": "A reason is required to delete an account"}, status=status.HTTP_400_BAD_REQUEST)
    reason = reason.strip()

    model, email_field, name_field = ACCOUNT_STATUS_MODELS[role]
    account = get_object_or_404(model, id=account_id)
    if account.scheduled_deletion_at:
        return Response({"success": False, "error": "This account is already scheduled for deletion."}, status=status.HTTP_400_BAD_REQUEST)

    account.account_status = "suspended"
    account.status_reason = reason
    account.scheduled_deletion_at = timezone.now() + timedelta(days=DELETION_GRACE_DAYS)
    account.save(update_fields=["account_status", "status_reason", "scheduled_deletion_at", "updated_at"])

    email = getattr(account, email_field)
    if email:
        send_deletion_scheduled_mail(getattr(account, name_field), email, reason, account.scheduled_deletion_at)

    return Response(
        {"success": True, "message": "Account suspended and scheduled for deletion.", "scheduled_deletion_at": account.scheduled_deletion_at},
        status=status.HTTP_200_OK
    )


# Email someone that they asked to delete their account and can still change their mind.
def send_self_deletion_mail(name, email, delete_on):
    message = (
        f"Hi {name},"
        "\n\n"
        f"We received your request to delete your NearBite account. It will be permanently deleted "
        f"in 30 days, on {delete_on:%d %b %Y}."
        "\n\n"
        "Changed your mind? Just log in again before then and your account will stay active "
        "and will not be deleted:"
        "\n"
        f"{settings.FRONTEND_URL}/login"
        "\n\n"
        "If you do nothing, the account and everything in it will be deleted for good after 30 days."
        "\n\n"
        "The NearBite Team"
    )
    send_status_mail("Your NearBite account will be deleted in 30 days", message, email)


# Email someone that logging in again cancelled their account deletion.
def send_deletion_cancelled_mail(name, email):
    message = (
        f"Hi {name or ''},"
        "\n\n"
        "Welcome back! You logged in again, so your account deletion was cancelled and your account is active."
        "\n\n"
        "The NearBite Team"
    )
    send_status_mail("Your NearBite account was not deleted", message, email)


# Let the owner of an account schedule its deletion in 30 days, after they confirm with their name and password.
# Logging in again within 30 days cancels it.
def schedule_self_deletion(request, account, role):
    model, email_field, name_field = ACCOUNT_STATUS_MODELS[role]
    name, password = request.data.get("name"), request.data.get("password")

    if not isinstance(name, str) or not isinstance(password, str) or not name.strip() or not password:
        return Response({"success": False, "error": "Your name and password are required to delete your account"}, status=status.HTTP_400_BAD_REQUEST)
    if name.strip().lower() != (getattr(account, name_field) or "").strip().lower():
        return Response({"success": False, "error": "The name does not match your account"}, status=status.HTTP_400_BAD_REQUEST)

    email = getattr(account, email_field)
    user_auth = UserAuth.objects.filter(user_email=email, user_role=role).first()
    if not user_auth or user_auth.user_password != password:
        return Response({"success": False, "error": "Incorrect password"}, status=status.HTTP_400_BAD_REQUEST)
    if account.scheduled_deletion_at:
        return Response({"success": False, "error": "This account is already scheduled for deletion"}, status=status.HTTP_400_BAD_REQUEST)

    account.account_status = "pending_deletion"
    account.status_reason = "Deleted by the account owner"
    account.scheduled_deletion_at = timezone.now() + timedelta(days=DELETION_GRACE_DAYS)
    account.save(update_fields=["account_status", "status_reason", "scheduled_deletion_at", "updated_at"])

    if email:
        send_self_deletion_mail(getattr(account, name_field), email, account.scheduled_deletion_at)

    return Response(
        {"success": True, "message": "Your account will be deleted in 30 days. Log in again before then to keep it.", "scheduled_deletion_at": account.scheduled_deletion_at},
        status=status.HTTP_200_OK
    )
