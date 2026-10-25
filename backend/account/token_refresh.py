from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.views import TokenRefreshView
from .models import UserAuth


class UserAuthTokenRefreshSerializer(TokenRefreshSerializer):

    # Refresh the token only if the account still exists.
    def validate(self, attrs):
        refresh = self.token_class(attrs["refresh"])

        if not UserAuth.objects.filter(id=refresh.payload.get('user_id')).exists():
            raise AuthenticationFailed('User no longer exists', code='user_not_found')

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
