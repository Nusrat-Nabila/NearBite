from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.views import TokenRefreshView
from .models import UserAuth
from .status import blocked_profile, blocked_message


class UserAuthTokenRefreshSerializer(TokenRefreshSerializer):

    # Refresh the token only if the account still exists.
    def validate(self, attrs):
        refresh = self.token_class(attrs["refresh"])

        user_auth = UserAuth.objects.filter(id=refresh.payload.get('user_id')).first()
        if not user_auth:
            raise AuthenticationFailed('User no longer exists', code='user_not_found')
        profile = blocked_profile(user_auth)
        if profile:
            raise AuthenticationFailed(blocked_message(profile), code='account_blocked')

        data = {"access": str(refresh.access_token)}

        if api_settings.ROTATE_REFRESH_TOKENS:
            if api_settings.BLACKLIST_AFTER_ROTATION:
                try:
                    refresh.blacklist()
                except AttributeError:
                    pass

            refresh.set_jti()
            refresh.set_exp()
            refresh.set_iat()
            refresh.outstand()

            data["refresh"] = str(refresh)

        return data


class UserAuthTokenRefreshView(TokenRefreshView):
    serializer_class = UserAuthTokenRefreshSerializer
