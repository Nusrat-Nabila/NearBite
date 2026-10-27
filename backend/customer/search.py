from django.db.models import Exists, F, OuterRef, Q, Subquery
from django.db.models.functions import Coalesce
from rest_framework import serializers

from account.models import Restaurant
from restaurant.models import (
    MEAL_TYPE_VALUES, OCCASION_VALUES, FoodCategory, MenuCategory, MenuItem, RestaurantMealType, RestaurantOccasion,
)

MEAL_TYPES = MEAL_TYPE_VALUES
OCCASIONS = OCCASION_VALUES
SORTS = ('name', 'price_low', 'price_high', 'nearest')
SORT_LABELS = {
    'name': 'Name (A to Z)',
    'price_low': 'Price: low to high',
    'price_high': 'Price: high to low',
    'nearest': 'Nearest',
}
MAX_WORDS = 6
MAX_QUERY_LENGTH = 100
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100
MAX_RADIUS_KM = 200


class SearchError(Exception):
    pass


# Read a comma separated or repeated parameter as a clean list.
def _list_param(query, name):
    found = []
    for raw in query.getlist(name):
        for piece in raw.split(','):
            piece = piece.strip().lower()
            if piece and piece not in found:
                found.append(piece)
    return found


# Read a decimal query parameter within a range.
def _number(query, name, low, high):
    raw = (query.get(name) or '').strip()
    try:
        value = float(raw)
    except ValueError:
        raise SearchError(f"{name} must be a number")
    if value != value or not low <= value <= high:
        raise SearchError(f"{name} must be between {low} and {high}")
    return value


# Read a whole-number query parameter within a range.
def _whole_number(query, name, low, high, default):
    if name not in query:
        return default
    raw = (query.get(name) or '').strip()
    if not raw.isdigit() or not low <= int(raw) <= high:
        raise SearchError(f"{name} must be a whole number from {low} to {high}")
    return int(raw)


# Read and check all search parameters from the query string.
def parse_search_params(query):
    params = {}

    text = ' '.join((query.get('q') or '').split())
    if len(text) > MAX_QUERY_LENGTH:
        raise SearchError(f"q can be at most {MAX_QUERY_LENGTH} characters")
    params['words'] = text.split(' ')[:MAX_WORDS] if text else []

    params['cuisines'] = _list_param(query, 'cuisine')
    params['categories'] = _list_param(query, 'category')
    params['dietary'] = _list_param(query, 'dietary')

    for name, allowed, key in (('meal', MEAL_TYPES, 'meals'), ('occasion', OCCASIONS, 'occasions')):
        values = _list_param(query, name)
        unknown = [v for v in values if v not in allowed]
        if unknown:
            raise SearchError(f"Unknown {name} '{unknown[0]}'. Use: {', '.join(allowed)}")
        params[key] = values

    params['open_now'] = False
    if 'open_now' in query:
        try:
            params['open_now'] = serializers.BooleanField().run_validation(query.get('open_now'))
        except serializers.ValidationError:
            raise SearchError("open_now must be true or false")

    has_lat, has_lng, has_place = 'lat' in query, 'lng' in query, bool((query.get('place') or '').strip())
    if has_lat != has_lng:
        raise SearchError("Send both lat and lng, or neither")
    if has_lat and has_place:
        raise SearchError("Use either lat and lng, or place, not both")
    params['origin'] = None
    params['place'] = None
    if has_lat:
        params['origin'] = (_number(query, 'lat', -90, 90), _number(query, 'lng', -180, 180))
    elif has_place:
        params['place'] = ' '.join(query.get('place').split())
        if len(params['place']) > MAX_QUERY_LENGTH:
            raise SearchError(f"place can be at most {MAX_QUERY_LENGTH} characters")

    has_position = params['origin'] is not None or params['place'] is not None
    params['radius_km'] = None
    if 'radius_km' in query:
        if not has_position:
            raise SearchError("radius_km needs lat and lng, or place")
        params['radius_km'] = _number(query, 'radius_km', 0.1, MAX_RADIUS_KM)

    sort = (query.get('sort') or '').strip().lower()
    if not sort:
        sort = 'nearest' if has_position else 'name'
    if sort not in SORTS:
        raise SearchError(f"Unknown sort '{sort}'. Use: {', '.join(SORTS)}")
    if sort == 'nearest' and not has_position:
        raise SearchError("sort=nearest needs lat and lng, or place")
    params['sort'] = sort

    for name in ('min_price', 'max_price'):
        params[name] = _whole_number(query, name, 0, 10_000_000, None) if (query.get(name) or '').strip() else None
    if params['min_price'] is not None and params['max_price'] is not None and params['min_price'] > params['max_price']:
        raise SearchError("min_price cannot be more than max_price")

    params['page'] = _whole_number(query, 'page', 1, 1_000_000, 1)
    params['page_size'] = _whole_number(query, 'page_size', 1, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE)
    return params


# Get the restaurants that pass the text and tag filters.
def restaurant_queryset(params):
    restaurants = Restaurant.objects.filter(account_status='active')
    dishes = MenuItem.objects.filter(restaurant=OuterRef('pk'))

    for word in params['words']:
        restaurants = restaurants.filter(
            Q(name__icontains=word) | Q(area__icontains=word) | Q(city__icontains=word) | Q(location__icontains=word)
            | Q(Exists(dishes.filter(name__icontains=word)))
            | Q(Exists(dishes.filter(cuisines__name__icontains=word)))
            | Q(Exists(dishes.filter(food_categories__name__icontains=word)))
            | Q(Exists(MenuCategory.objects.filter(restaurant=OuterRef('pk'), name__icontains=word)))
        )

    if params['cuisines']:
        restaurants = restaurants.filter(Exists(dishes.filter(cuisines__slug__in=params['cuisines'])))
    if params['categories']:
        names = FoodCategory.objects.filter(slug__in=params['categories']).values_list('name', flat=True)
        sells = Q(Exists(dishes.filter(food_categories__slug__in=params['categories'])))
        for name in names:
            sells |= (
                Q(name__icontains=name)
                | Q(Exists(dishes.filter(name__icontains=name)))
                | Q(Exists(MenuCategory.objects.filter(restaurant=OuterRef('pk'), name__icontains=name)))
            )
        restaurants = restaurants.filter(sells)
    for slug in params['dietary']:
        restaurants = restaurants.filter(Exists(dishes.filter(dietary_tags__slug=slug)))
    if params['meals']:
        restaurants = restaurants.filter(Exists(RestaurantMealType.objects.filter(restaurant=OuterRef('pk'), meal_type__in=params['meals'])))
    if params['occasions']:
        restaurants = restaurants.filter(Exists(RestaurantOccasion.objects.filter(restaurant=OuterRef('pk'), occasion__in=params['occasions'])))

    cheapest_dish = (
        MenuItem.objects.filter(restaurant=OuterRef('pk'), is_available=True, price__gt=0)
        .order_by('price').values('price')[:1]
    )
    restaurants = restaurants.annotate(starting_price=Coalesce(F('min_price'), Subquery(cheapest_dish)))
    if params['min_price'] is not None:
        restaurants = restaurants.filter(starting_price__gte=params['min_price'])
    if params['max_price'] is not None:
        restaurants = restaurants.filter(starting_price__lte=params['max_price'])
    return restaurants.order_by('name', 'id')
