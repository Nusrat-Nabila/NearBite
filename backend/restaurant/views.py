# Restaurant app API views: menu, orders and restaurant profile endpoints.
from decimal import ROUND_HALF_UP, Decimal

from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, authentication_classes, parser_classes, permission_classes
from account.parsers import SafeJSONParser
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import serializers, status
from django.db import transaction
from django.db.models import Avg, Count, F
from django.utils import timezone
from account.models import Restaurant
from account.pagination import paginated_response
from account.serializers import RestaurantSerializer
from account.views import is_owner, not_authorized_response, sync_user_auth, delete_user_auth
from customer import geo
from .deals import STATUSES, best_item_deals, status_filter
from .models import (
    Review, DishReview, DietaryTag, Cuisine, FoodCategory, MenuCategory, MenuItem, OpeningHour, DailyDeals, RestaurantMealType, RestaurantOccasion,
    MEAL_TYPE_VALUES, OCCASION_VALUES,
)
from .serializers import (
    DietaryTagSerializer, CuisineSerializer, FoodCategorySerializer,
    MenuCategorySerializer, MenuItemSerializer, MenuItemDetailSerializer,
    OpeningHourSerializer, DailyDealsSerializer, DailyDealCardSerializer,
)

# Round an average to one decimal, halves going up (4.25 becomes 4.3).
def one_decimal(value):
    return float(Decimal(str(value)).quantize(Decimal('0.1'), rounding=ROUND_HALF_UP))


# Add the average rating (one decimal) and rating count to each restaurant.
def add_rating_summary(items):
    rows = (
        Review.objects.filter(restaurant_id__in=[item['id'] for item in items])
        .values('restaurant_id')
        .annotate(average=Avg('rating'), count=Count('id'))
    )
    summary = {row['restaurant_id']: (row['count'], one_decimal(row['average'])) for row in rows}

    for item in items:
        count, rating = summary.get(item['id'], (0, None))
        item['rating'] = rating
        item['rating_count'] = count
    return items


# Add the average rating (one decimal) and rating count to each dish.
def add_dish_rating_summary(items):
    rows = (
        DishReview.objects.filter(menu_item_id__in=[item['id'] for item in items])
        .values('menu_item_id')
        .annotate(average=Avg('rating'), count=Count('id'))
    )
    summary = {row['menu_item_id']: (row['count'], one_decimal(row['average'])) for row in rows}

    for item in items:
        count, rating = summary.get(item['id'], (0, None))
        item['rating'] = rating
        item['rating_count'] = count
    return items


# Build the serializer context with the current deals for the dishes.
def dish_context(request, dishes):
    return {'request': request, 'item_deals': best_item_deals([d.id for d in dishes], timezone.localdate())}


# Add cuisines, food categories and dietary tags to each restaurant.
def add_menu_tags(items):
    ids = [item['id'] for item in items]
    sources = (
        ('dietary_tags', MenuItem.dietary_tags.through, 'dietarytag'),
        ('cuisines', MenuItem.cuisines.through, 'cuisine'),
        ('food_categories', MenuItem.food_categories.through, 'foodcategory'),
    )
    for key, through, field in sources:
        rows = (
            through.objects.filter(menuitem__restaurant_id__in=ids)
            .values('menuitem__restaurant_id', f'{field}_id', f'{field}__name', f'{field}__slug')
            .distinct()
        )
        found = {}
        for row in rows:
            found.setdefault(row['menuitem__restaurant_id'], {})[row[f'{field}_id']] = {
                'id': row[f'{field}_id'],
                'name': row[f'{field}__name'],
                'slug': row[f'{field}__slug'],
            }
        for item in items:
            item[key] = sorted(found.get(item['id'], {}).values(), key=lambda t: t['name'].lower())
    return items


# Load the opening hours of the given restaurants, grouped by restaurant and day.
def load_hours(restaurant_ids):
    by_restaurant = {}
    for hour in OpeningHour.objects.filter(restaurant_id__in=restaurant_ids):
        by_restaurant.setdefault(hour.restaurant_id, {})[hour.day_of_week] = hour
    return by_restaurant


# Check if a restaurant is open at a given time.
def is_open_at(days, temporarily_closed, now):
    if temporarily_closed:
        return False

    current = now.time()
    today = now.weekday()
    yesterday = (today - 1) % 7

    # Check that an opening hour has both times and is not closed.
    def usable(hour):
        return hour is not None and not hour.is_closed and hour.open_time and hour.close_time

    today_hours = days.get(today)
    if usable(today_hours):
        if today_hours.open_time < today_hours.close_time:
            if today_hours.open_time <= current < today_hours.close_time:
                return True
        elif current >= today_hours.open_time:
            return True

    yesterday_hours = days.get(yesterday)
    if usable(yesterday_hours) and yesterday_hours.close_time < yesterday_hours.open_time and current < yesterday_hours.close_time:
        return True

    return None if today_hours is None else False


# Add the open-now flag and status text to each restaurant.
def add_open_now(items, hours_by_restaurant=None, now=None):
    if hours_by_restaurant is None:
        hours_by_restaurant = load_hours([item['id'] for item in items])
    now = now or timezone.localtime()
    for item in items:
        is_open = is_open_at(hours_by_restaurant.get(item['id'], {}), item['is_temporarily_closed'], now)
        item['is_open_now'] = is_open
        item['opening_status'] = 'hours_not_set' if is_open is None else ('open' if is_open else 'closed')
    return items


PRIVATE_RESTAURANT_FIELDS = ('email', 'business_reg_id', 'owner_name')


# Remove the private fields from each restaurant.
def hide_private(items):
    for item in items:
        for field in PRIVATE_RESTAURANT_FIELDS:
            item.pop(field, None)
    return items


# Add the meal types and dining occasions to each restaurant.
def add_dining_info(items):
    ids = [item['id'] for item in items]
    for key, model, field, order in (
        ('meal_types', RestaurantMealType, 'meal_type', MEAL_TYPE_VALUES),
        ('dining_occasions', RestaurantOccasion, 'occasion', OCCASION_VALUES),
    ):
        found = {}
        for restaurant_id, value in model.objects.filter(restaurant_id__in=ids).values_list('restaurant_id', field):
            found.setdefault(restaurant_id, []).append(value)
        for item in items:
            item[key] = sorted(found.get(item['id'], []), key=order.index)
    return items


# List the restaurants.
@api_view(['GET'])
@authentication_classes([])  
@permission_classes([AllowAny])
def list_restaurant(request):
    restaurants = Restaurant.objects.all().order_by('name', 'id')

    # Turn restaurants into serialized items.
    def to_items(rows):
        serializer = RestaurantSerializer(rows, many=True, context={'request': request})
        return hide_private(add_open_now(add_dining_info(add_menu_tags(add_rating_summary(list(serializer.data))))))

    return paginated_response(request, restaurants, to_items)


# Show a restaurant's profile.
@api_view(['GET'])
@authentication_classes([])   
@permission_classes([AllowAny])
def view_restaurant_profile(request, restaurant_id):
    restaurant = get_object_or_404(Restaurant, id=restaurant_id)
    serializer = RestaurantSerializer(restaurant, context={'request': request})
    items = hide_private(add_dining_info(add_menu_tags(add_rating_summary([dict(serializer.data)]))))
    hours = load_hours([restaurant.id])
    add_open_now(items, hours)
    item = items[0]
    item['opening_hours'] = weekly_schedule(restaurant, hours.get(restaurant.id, {}))['hours']
    return Response(item, status=status.HTTP_200_OK)


# Update the restaurant's profile.
@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_restaurant_profile(request, restaurant_id):
    user = request.user
    restaurant = get_object_or_404(Restaurant, id=restaurant_id)
    if not is_owner(user, "restaurant", restaurant.email):
        return not_authorized_response()

    old_email = restaurant.email
    serializer = RestaurantSerializer(restaurant, data=request.data, partial=True, context={'request': request})
    if serializer.is_valid():
        restaurant = serializer.save()
        sync_user_auth(old_email, "restaurant", restaurant.name, restaurant.email, restaurant.password)
        return Response(serializer.data, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# Delete a restaurant account.
@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_restaurant(request, restaurant_id):
    user = request.user
    restaurant = get_object_or_404(Restaurant, id=restaurant_id)
    if not is_owner(user, "restaurant", restaurant.email):
        return not_authorized_response()
    delete_user_auth(restaurant.email, "restaurant")
    restaurant.delete()
    return Response({"message": "Restaurant deleted successfully"}, status=status.HTTP_200_OK)


# Get the restaurant of the logged-in owner.
def get_my_restaurant(user):
    if getattr(user, 'user_role', None) != 'restaurant':
        return None
    return Restaurant.objects.filter(email=user.user_email).first()


# Return the 403 response for restaurant-only endpoints.
def restaurant_only_response():
    return Response({"success": False, "error": "Only a restaurant can do this"}, status=status.HTTP_403_FORBIDDEN)


# List the dietary tags a restaurant can choose from.
@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def list_dietary_tag_options(request):
    tags = DietaryTag.objects.all().order_by('name')
    return Response(DietaryTagSerializer(tags, many=True).data, status=status.HTTP_200_OK)


# List the cuisines a restaurant can choose from.
@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def list_cuisine_options(request):
    cuisines = Cuisine.objects.all().order_by('name')
    return Response(CuisineSerializer(cuisines, many=True, context={'request': request}).data, status=status.HTTP_200_OK)


# List the food categories a restaurant can choose from.
@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def list_food_category_options(request):
    categories = FoodCategory.objects.all().order_by('name')
    return Response(FoodCategorySerializer(categories, many=True).data, status=status.HTTP_200_OK)


# Create a menu category.
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_menu_category(request):
    restaurant = get_my_restaurant(request.user)
    if not restaurant:
        return restaurant_only_response()
    serializer = MenuCategorySerializer(data=request.data, context={'request': request, 'restaurant': restaurant})
    if serializer.is_valid():
        serializer.save(restaurant=restaurant)
        return Response({"success": True, "data": serializer.data}, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# List the restaurant's menu categories.
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_menu_category(request):
    restaurant = get_my_restaurant(request.user)
    if not restaurant:
        return restaurant_only_response()
    categories = MenuCategory.objects.filter(restaurant=restaurant).order_by(F('display_order').asc(nulls_last=True), 'name')
    return Response(MenuCategorySerializer(categories, many=True).data, status=status.HTTP_200_OK)


# Update a menu category.
@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_menu_category(request, category_id):
    restaurant = get_my_restaurant(request.user)
    if not restaurant:
        return restaurant_only_response()
    category = get_object_or_404(MenuCategory, id=category_id)
    if category.restaurant_id != restaurant.id:
        return not_authorized_response()
    serializer = MenuCategorySerializer(category, data=request.data, partial=True, context={'request': request, 'restaurant': restaurant})
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# Delete a menu category.
@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_menu_category(request, category_id):
    restaurant = get_my_restaurant(request.user)
    if not restaurant:
        return restaurant_only_response()
    category = get_object_or_404(MenuCategory, id=category_id)
    if category.restaurant_id != restaurant.id:
        return not_authorized_response()
    category.delete()
    return Response({"message": "Menu category deleted successfully"}, status=status.HTTP_200_OK)


# Create a dish.
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_menu_item(request):
    restaurant = get_my_restaurant(request.user)
    if not restaurant:
        return restaurant_only_response()
    serializer = MenuItemSerializer(data=request.data, context={'request': request})
    if serializer.is_valid():
        item = serializer.save(restaurant=restaurant)
        data = MenuItemDetailSerializer(item, context={'request': request}).data
        return Response({"success": True, "data": data}, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# List the restaurant's dishes.
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_menu_item(request):
    restaurant = get_my_restaurant(request.user)
    if not restaurant:
        return restaurant_only_response()

    items = MenuItem.objects.filter(restaurant=restaurant).prefetch_related('dietary_tags', 'cuisines', 'food_categories').order_by('name')
    wanted = (request.query_params.get('category') or '').strip().lower()
    if wanted == 'none':
        items = items.filter(category__isnull=True)
    elif wanted:
        if not wanted.isdigit() or int(wanted) > 9_223_372_036_854_775_807:
            return Response({"success": False, "error": "category must be a category id or 'none'"}, status=status.HTTP_400_BAD_REQUEST)
        items = items.filter(category_id=int(wanted))

    # Turn dishes into serialized data.
    def to_data(rows):
        return add_dish_rating_summary(list(MenuItemDetailSerializer(rows, many=True, context=dish_context(request, rows)).data))

    return paginated_response(request, items, to_data)


# Show one dish.
@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def view_menu_item(request, item_id):
    item = get_object_or_404(MenuItem.objects.prefetch_related('dietary_tags', 'cuisines', 'food_categories'), id=item_id)
    data = add_dish_rating_summary([dict(MenuItemDetailSerializer(item, context={'request': request}).data)])[0]
    return Response(data, status=status.HTTP_200_OK)


# Update a dish.
@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_menu_item(request, item_id):
    restaurant = get_my_restaurant(request.user)
    if not restaurant:
        return restaurant_only_response()
    item = get_object_or_404(MenuItem, id=item_id)
    if item.restaurant_id != restaurant.id:
        return not_authorized_response()
    serializer = MenuItemSerializer(item, data=request.data, partial=True, context={'request': request})
    if serializer.is_valid():
        item = serializer.save()
        return Response(MenuItemDetailSerializer(item, context={'request': request}).data, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# Delete a dish.
@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_menu_item(request, item_id):
    restaurant = get_my_restaurant(request.user)
    if not restaurant:
        return restaurant_only_response()
    item = get_object_or_404(MenuItem, id=item_id)
    if item.restaurant_id != restaurant.id:
        return not_authorized_response()
    item.delete()
    return Response({"message": "Menu item deleted successfully"}, status=status.HTTP_200_OK)


# Mark a dish as available or out of stock.
@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_menu_item_availability(request, item_id):
    restaurant = get_my_restaurant(request.user)
    if not restaurant:
        return restaurant_only_response()
    item = get_object_or_404(MenuItem, id=item_id)
    if item.restaurant_id != restaurant.id:
        return not_authorized_response()

    if 'is_available' not in request.data:
        return Response({"success": False, "error": "is_available is required (true or false)"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        available = serializers.BooleanField().run_validation(request.data.get('is_available'))
    except serializers.ValidationError:
        return Response({"success": False, "error": "is_available must be true or false"}, status=status.HTTP_400_BAD_REQUEST)

    item.is_available = available
    item.save(update_fields=['is_available', 'updated_at'])
    return Response(MenuItemDetailSerializer(item, context={'request': request}).data, status=status.HTTP_200_OK)


# Return the restaurant's closed flag and open-now status.
def restaurant_status(restaurant):
    item = {'id': restaurant.id, 'is_temporarily_closed': restaurant.is_temporarily_closed}
    add_open_now([item], load_hours([restaurant.id]))
    return {key: item[key] for key in ('is_temporarily_closed', 'is_open_now', 'opening_status')}


# Close the restaurant temporarily or reopen it.
@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_temporary_closure(request):
    restaurant = get_my_restaurant(request.user)
    if not restaurant:
        return restaurant_only_response()

    if 'is_temporarily_closed' not in request.data:
        return Response({"success": False, "error": "is_temporarily_closed is required (true or false)"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        closed = serializers.BooleanField().run_validation(request.data.get('is_temporarily_closed'))
    except serializers.ValidationError:
        return Response({"success": False, "error": "is_temporarily_closed must be true or false"}, status=status.HTTP_400_BAD_REQUEST)

    restaurant.is_temporarily_closed = closed
    restaurant.save(update_fields=['is_temporarily_closed', 'updated_at'])
    return Response(
        {"restaurant": {"id": restaurant.id, "name": restaurant.name}, **restaurant_status(restaurant)},
        status=status.HTTP_200_OK
    )


# Build the full week's opening hours with the same shape for every day.
def weekly_schedule(restaurant, saved=None):
    if saved is None:
        saved = {hour.day_of_week: hour for hour in OpeningHour.objects.filter(restaurant=restaurant)}
    week = []
    for day, name in OpeningHour.DAY_CHOICES:
        if day in saved:
            data = OpeningHourSerializer(saved[day]).data
            entry = {key: data[key] for key in ('day_of_week', 'day_name', 'open_time', 'close_time', 'is_closed')}
            entry['is_set'] = True
        else:
            entry = {'day_of_week': day, 'day_name': name, 'open_time': None, 'close_time': None, 'is_closed': False, 'is_set': False}
        week.append(entry)
    return {"restaurant": {"id": restaurant.id, "name": restaurant.name}, "hours": week}


# Save the weekly opening hours.
@api_view(['PUT'])
@parser_classes([SafeJSONParser])
@permission_classes([IsAuthenticated])
def update_opening_hours(request):
    restaurant = get_my_restaurant(request.user)
    if not restaurant:
        return restaurant_only_response()

    entries = request.data
    if not isinstance(entries, list) or not entries:
        return Response({"success": False, "error": "Send a list with one entry per day"}, status=status.HTTP_400_BAD_REQUEST)
    if len(entries) > 7:
        return Response({"success": False, "error": "A week has only 7 days"}, status=status.HTTP_400_BAD_REQUEST)

    validated, problems, seen = [], [], set()
    for position, entry in enumerate(entries):
        serializer = OpeningHourSerializer(data=entry)
        if not serializer.is_valid():
            problems.append({"entry": position, "errors": serializer.errors})
            continue
        day = serializer.validated_data['day_of_week']
        if day in seen:
            problems.append({"entry": position, "errors": {"day_of_week": ["This day is listed more than once"]}})
            continue
        seen.add(day)
        validated.append(serializer.validated_data)
    if problems:
        return Response({"success": False, "error": "Some entries are not valid", "problems": problems}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        for data in validated:
            OpeningHour.objects.update_or_create(
                restaurant=restaurant,
                day_of_week=data['day_of_week'],
                defaults={
                    'open_time': data.get('open_time'),
                    'close_time': data.get('close_time'),
                    'is_closed': data.get('is_closed', False),
                },
            )
    return Response(weekly_schedule(restaurant), status=status.HTTP_200_OK)


# Show the weekly opening hours.
@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def view_opening_hours(request, restaurant_id):
    restaurant = get_object_or_404(Restaurant, id=restaurant_id)
    return Response(weekly_schedule(restaurant), status=status.HTTP_200_OK)


# Create an offer.
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_offer(request):
    restaurant = get_my_restaurant(request.user)
    if not restaurant:
        return restaurant_only_response()
    serializer = DailyDealsSerializer(data=request.data, context={'request': request, 'restaurant': restaurant})
    if serializer.is_valid():
        serializer.save(restaurant=restaurant)
        return Response({"success": True, "data": serializer.data}, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# List the restaurant's offers.
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_offer(request):
    restaurant = get_my_restaurant(request.user)
    if not restaurant:
        return restaurant_only_response()

    offers = DailyDeals.objects.filter(restaurant=restaurant).prefetch_related('menu_items').order_by('-created_at', '-id')
    wanted = (request.query_params.get('status') or '').strip().lower()
    if wanted:
        if wanted not in STATUSES:
            return Response({"success": False, "error": "status must be active, scheduled, expired or paused"}, status=status.HTTP_400_BAD_REQUEST)
        offers = offers.filter(status_filter(wanted, timezone.localdate()))
    return paginated_response(request, offers, lambda rows: DailyDealsSerializer(rows, many=True, context={'request': request}).data)


# Update an offer.
@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_offer(request, offer_id):
    restaurant = get_my_restaurant(request.user)
    if not restaurant:
        return restaurant_only_response()
    offer = get_object_or_404(DailyDeals, id=offer_id)
    if offer.restaurant_id != restaurant.id:
        return not_authorized_response()
    serializer = DailyDealsSerializer(offer, data=request.data, partial=True, context={'request': request, 'restaurant': restaurant})
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# Delete an offer.
@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_offer(request, offer_id):
    restaurant = get_my_restaurant(request.user)
    if not restaurant:
        return restaurant_only_response()
    offer = get_object_or_404(DailyDeals, id=offer_id)
    if offer.restaurant_id != restaurant.id:
        return not_authorized_response()
    offer.delete()
    return Response({"message": "Offer deleted successfully"}, status=status.HTTP_200_OK)


# List the daily deals of all restaurants.
@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def list_daily_deals(request):
    limit = 10
    if 'limit' in request.query_params:
        raw = request.query_params.get('limit', '').strip()
        if not raw.isdigit() or not 1 <= int(raw) <= 50:
            return Response({"success": False, "error": "limit must be a whole number from 1 to 50"}, status=status.HTTP_400_BAD_REQUEST)
        limit = int(raw)

    offers = (
        DailyDeals.objects.filter(status_filter('active', timezone.localdate()), restaurant__is_temporarily_closed=False)
        .select_related('restaurant')
        .prefetch_related('menu_items')
        .order_by(F('discount_percentage').desc(nulls_last=True), '-created_at', '-id')
    )
    best_per_restaurant, seen = [], set()
    for offer in offers:
        if offer.restaurant_id in seen:
            continue
        seen.add(offer.restaurant_id)
        best_per_restaurant.append(offer)
        if len(best_per_restaurant) == limit:
            break
    return Response(DailyDealCardSerializer(best_per_restaurant, many=True, context={'request': request}).data, status=status.HTTP_200_OK)


# Show one offer.
@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def view_offer(request, offer_id):
    today = timezone.localdate()
    offer = (
        DailyDeals.objects.filter(status_filter('active', today), restaurant__is_temporarily_closed=False, id=offer_id)
        .select_related('restaurant')
        .prefetch_related('menu_items')
        .first()
    )
    if offer is None:
        return Response({"success": False, "error": "This deal is not available"}, status=status.HTTP_404_NOT_FOUND)

    data = dict(DailyDealCardSerializer(offer, context={'request': request}).data)
    restaurant_state = restaurant_status(offer.restaurant)
    data['restaurant'] = {
        **data['restaurant'],
        'location': offer.restaurant.location,
        'opening_status': restaurant_state['opening_status'],
        'is_open_now': restaurant_state['is_open_now'],
    }
    data['days_left'] = (offer.end_date - today).days if offer.end_date else None
    return Response(data, status=status.HTTP_200_OK)


# Get the visitor's IP address.
def client_ip(request):
    return request.META.get('REMOTE_ADDR', 'unknown')


# Build a JSON error response.
def error_response(message, code):
    return Response({"success": False, "error": message}, status=code)


# Save the meal types and dining occasions the restaurant chose.
@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_dining_info(request):
    restaurant = get_my_restaurant(request.user)
    if not restaurant:
        return restaurant_only_response()

    wanted = {}
    for key, allowed in (('meal_types', MEAL_TYPE_VALUES), ('dining_occasions', OCCASION_VALUES)):
        if key not in request.data:
            continue
        raw = request.data.getlist(key) if hasattr(request.data, 'getlist') else request.data.get(key)
        if not isinstance(raw, list) or not all(isinstance(v, str) for v in raw):
            return error_response(f"{key} must be a list of text values", status.HTTP_400_BAD_REQUEST)
        values = []
        for piece in (p.strip().lower() for v in raw for p in v.split(',')):
            if piece and piece not in values:
                values.append(piece)
        unknown = [v for v in values if v not in allowed]
        if unknown:
            return error_response(f"Unknown value '{unknown[0]}' in {key}. Use: {', '.join(allowed)}", status.HTTP_400_BAD_REQUEST)
        wanted[key] = values
    if not wanted:
        return error_response("Send meal_types and/or dining_occasions", status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        for key, model, field in (('meal_types', RestaurantMealType, 'meal_type'), ('dining_occasions', RestaurantOccasion, 'occasion')):
            if key not in wanted:
                continue
            model.objects.filter(restaurant=restaurant).exclude(**{f'{field}__in': wanted[key]}).delete()
            for value in wanted[key]:
                model.objects.get_or_create(restaurant=restaurant, **{field: value})

    item = add_dining_info([{'id': restaurant.id}])[0]
    return Response({"meal_types": item['meal_types'], "dining_occasions": item['dining_occasions']}, status=status.HTTP_200_OK)


# Set the restaurant's map position from its address.
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def locate_my_restaurant(request):
    restaurant = get_my_restaurant(request.user)
    if not restaurant:
        return restaurant_only_response()

    address = ' '.join(str(request.data.get('address') or '').split())
    if not address:
        address = ', '.join(part for part in (restaurant.location, restaurant.area, restaurant.city) if part)
    if not address:
        return error_response("Add your location, area or city first, or send an address", status.HTTP_400_BAD_REQUEST)

    found, problem = geo.find_place_or_error(client_ip(request), address)
    if problem:
        return error_response(*problem)
    restaurant.latitude, restaurant.longitude = found[0], found[1]
    restaurant.save(update_fields=['latitude', 'longitude', 'updated_at'])
    return Response({
        "restaurant": {"id": restaurant.id, "name": restaurant.name},
        "latitude": found[0],
        "longitude": found[1],
        "matched_place": found[2],
    }, status=status.HTTP_200_OK)


# Show a restaurant's public menu.
@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def view_restaurant_menu(request, restaurant_id):
    restaurant = get_object_or_404(Restaurant, id=restaurant_id)
    categories = MenuCategory.objects.filter(restaurant=restaurant).order_by(F('display_order').asc(nulls_last=True), 'name')
    items = list(MenuItem.objects.filter(restaurant=restaurant).prefetch_related('dietary_tags', 'cuisines', 'food_categories').order_by('name'))

    by_category = {}
    for dish in add_dish_rating_summary(list(MenuItemDetailSerializer(items, many=True, context=dish_context(request, items)).data)):
        by_category.setdefault(dish['category'], []).append(dish)

    return Response({
        "restaurant": {"id": restaurant.id, "name": restaurant.name, **restaurant_status(restaurant)},
        "categories": [
            {"id": c.id, "name": c.name, "display_order": c.display_order, "items": by_category.get(c.id, [])}
            for c in categories
        ],
        "uncategorized": by_category.get(None, []),
    }, status=status.HTTP_200_OK)
