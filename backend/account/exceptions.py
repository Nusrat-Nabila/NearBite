import logging

from django.db import IntegrityError
from rest_framework.response import Response
from rest_framework.views import exception_handler, set_rollback

logger = logging.getLogger(__name__)


# Wrap DRF's default error handling so every error comes back in the same JSON shape.
def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None and isinstance(exc, IntegrityError):
        logger.warning("Database rule refused a save in %s", context.get('view').__class__.__name__, exc_info=exc)
        set_rollback()
        return Response(
            {"success": False, "error": "That conflicts with something that was saved at the same moment. Please try again."},
            status=409,
        )
    return response
