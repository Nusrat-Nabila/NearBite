from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from .models import UserAuth


class UserAuthJWTAuthentication(JWTAuthentication):
    # Look up the UserAuth account named in a valid token.
    def get_user(self, validated_token):
        try:
            user_id = validated_token.get('user_id')
            return UserAuth.objects.get(id=user_id)
        except UserAuth.DoesNotExist:
            raise AuthenticationFailed('User no longer exists', code='user_not_found')
