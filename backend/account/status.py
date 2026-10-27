from django.db import transaction
from django.utils import timezone

from .models import Customer, Restaurant, UserAuth

PROFILE_BY_ROLE = {
    "customer": (Customer, "customer_email"),
    "restaurant": (Restaurant, "email"),
}


# Find the customer or restaurant record behind a role and email.
def find_profile(role, email):
    spec = PROFILE_BY_ROLE.get(role)
    if not spec:
        return None
    model, email_field = spec
    return model.objects.filter(**{email_field: email}).first()


# Return the profile when its account is suspended or disabled, otherwise None.
def blocked_profile(user_auth):
    profile = find_profile(user_auth.user_role, user_auth.user_email)
    if profile and profile.account_status != 'active':
        return profile
    return None


# Write the sentence shown to someone whose account is blocked.
def blocked_message(profile):
    reason = (profile.status_reason or '').strip()
    if profile.account_status == 'pending_deletion':
        return f"Your account is scheduled for deletion on {profile.scheduled_deletion_at:%d %b %Y}. Log in again to keep it."
    if profile.scheduled_deletion_at:
        text = f"Your account is suspended and will be permanently deleted on {profile.scheduled_deletion_at:%d %b %Y}."
        if reason:
            text += f" Reason: {reason}."
        return text + " Reply to the email we sent you if you think this is a mistake."
    text = "Your account has been suspended."
    if reason:
        text += f" Reason: {reason}."
    return text + " It will not be reactivated automatically. Reply to the email we sent you to ask the admin to reactivate it."


# Delete the accounts whose 30 days are over, and tell their owners.
def purge_due_accounts():
    from .views import send_account_deleted_mail

    now = timezone.now()
    for model, email_field, name_field, role in (
        (Customer, "customer_email", "customer_name", "customer"),
        (Restaurant, "email", "name", "restaurant"),
    ):
        for account in model.objects.filter(scheduled_deletion_at__lte=now):
            name, email, reason = getattr(account, name_field), getattr(account, email_field), account.status_reason
            with transaction.atomic():
                if email:
                    UserAuth.objects.filter(user_email=email, user_role=role).delete()
                account.delete()
            if email:
                send_account_deleted_mail(name, email, reason)
