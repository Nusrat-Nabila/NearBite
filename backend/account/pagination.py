import math

from django.db.models import QuerySet
from rest_framework import status
from rest_framework.response import Response

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100
MAX_PAGE = 1_000_000


class PageError(Exception):
    pass


# Read a whole-number query parameter within a range or raise PageError.
def _whole_number(query, name, low, high, default):
    if name not in query:
        return default
    raw = (query.get(name) or '').strip()
    if not raw.isdigit() or not low <= int(raw) <= high:
        raise PageError(f"{name} must be a whole number from {low} to {high}")
    return int(raw)


# Read page and page_size from the query string.
def page_params(query):
    return (
        _whole_number(query, 'page', 1, MAX_PAGE, 1),
        _whole_number(query, 'page_size', 1, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE),
    )


# Build a paginated JSON response from a queryset or list.
def paginated_response(request, rows, serialize=None, **extra):
    try:
        page, page_size = page_params(request.query_params)
    except PageError as error:
        return Response({"success": False, "error": str(error)}, status=status.HTTP_400_BAD_REQUEST)

    count = rows.count() if isinstance(rows, QuerySet) else len(rows)
    start = (page - 1) * page_size
    page_rows = list(rows[start:start + page_size])
    return Response({
        "count": count,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, math.ceil(count / page_size)),
        **extra,
        "results": serialize(page_rows) if serialize else page_rows,
    }, status=status.HTTP_200_OK)
