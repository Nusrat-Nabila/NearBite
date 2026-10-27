from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from .models import UserAuth
from .status import blocked_profile, blocked_message


class UserAuthJWTAuthentication(JWTAuthentication):
    # Look up the UserAuth account named in a valid token.
    def get_user(self, validated_token):
        try:
            user_id = validated_token.get('user_id')
            user_auth = UserAuth.objects.get(id=user_id)
        except UserAuth.DoesNotExist:
            raise AuthenticationFailed('User no longer exists', code='user_not_found')
        profile = blocked_profile(user_auth)
        if profile:
            raise AuthenticationFailed(blocked_message(profile), code='account_blocked')
        return user_auth
