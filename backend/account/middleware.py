from django.conf import settings
from django.http import JsonResponse


class RequestSizeLimitMiddleware:

    # Store the next handler in the chain.
    def __init__(self, get_response):
        self.get_response = get_response

    # Reject requests whose body is larger than the allowed size.
    def __call__(self, request):
        try:
            announced = int(request.META.get('CONTENT_LENGTH') or 0)
        except ValueError:
            announced = 0
        if announced > settings.MAX_REQUEST_BYTES:
            megabytes = settings.MAX_REQUEST_BYTES // (1024 * 1024)
            return JsonResponse(
                {"success": False, "error": f"The upload is too large. The biggest request allowed is {megabytes} MB."},
                status=413,
            )
        return self.get_response(request)
