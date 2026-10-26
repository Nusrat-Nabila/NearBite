import math
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Q
from django.utils import timezone
from account.models import Customer
from account.pagination import paginated_response
from account.serializers import CustomerSerializer, RestaurantSerializer
from account.views import (
    is_admin, is_owner, admin_only_response, not_authorized_response,
    sync_user_auth, delete_user_auth,
)
from adminpanel.models import RestaurantReport
from restaurant.models import RATING_VALUES, rating_key, Cuisine, FoodCategory, DietaryTag, DishReview, MenuCategory, MenuItem, Review, RestaurantMealType, RestaurantOccasion
from restaurant.moderation import has_bad_language, send_review_removed_email
from restaurant.serializers import CuisineSerializer, DietaryTagSerializer
from restaurant.views import (
    add_dining_info, add_dish_rating_summary, add_menu_tags, add_open_now, add_rating_summary, client_ip, dish_context, error_response,
    hide_private, is_open_at, load_hours, restaurant_status, weekly_schedule,
)
from account.authentication import UserAuthJWTAuthentication
from account.models import Restaurant
from django.db.models import Count, Exists, F, Max, Min, OuterRef
from . import geo, restaurant_page, search
from .models import BookmarkRestaurant
from .serializers import DishSerializer


# List customers for the admin.
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_customer(request):
    if not is_admin(request.user):
        return admin_only_response()
    customers = Customer.objects.all().order_by('customer_name', 'id')
    return paginated_response(request, customers, lambda rows: CustomerSerializer(rows, many=True, context={'request': request}).data)


# Search customers by name or email.
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def search_customer(request):
    if not is_admin(request.user):
        return admin_only_response()

    query = request.GET.get('search', '').strip()
    customers = Customer.objects.all()
    if query:
        customers = customers.filter(
            Q(customer_name__icontains=query) | Q(customer_email__icontains=query)
        )
    customers = customers.order_by('customer_name', 'id')
    return paginated_response(request, customers, lambda rows: CustomerSerializer(rows, many=True, context={'request': request}).data)


# Show the logged-in customer's profile.
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def view_customer_profile(request, customer_id):
    user = request.user
    customer = get_object_or_404(Customer, id=customer_id)
    if not is_admin(user) and not is_owner(user, "customer", customer.customer_email):
        return not_authorized_response()
    serializer = CustomerSerializer(customer, context={'request': request})
    return Response(serializer.data, status=status.HTTP_200_OK)


# Update the logged-in customer's profile.
@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_customer_profile(request, customer_id):
    user = request.user
    customer = get_object_or_404(Customer, id=customer_id)
    if not is_owner(user, "customer", customer.customer_email):
        return not_authorized_response()

    old_email = customer.customer_email
    serializer = CustomerSerializer(customer, data=request.data, partial=True, context={'request': request})
    if serializer.is_valid():
        customer = serializer.save()
        sync_user_auth(old_email, "customer", customer.customer_name, customer.customer_email, customer.customer_password)
        return Response(serializer.data, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# Delete a customer account.
@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_customer(request, customer_id):
    user = request.user
    customer = get_object_or_404(Customer, id=customer_id)
    if not is_owner(user, "customer", customer.customer_email):
        return not_authorized_response()
    delete_user_auth(customer.customer_email, "customer")
    customer.delete()
    return Response({"message": "Customer deleted successfully"}, status=status.HTTP_200_OK)


# Find a place for a visitor or return an error response.
def look_up_place(request, text):
    found, problem = geo.find_place_or_error(client_ip(request), text)
    if problem:
        return None, error_response(*problem)
    return found, None


# Add the dishes that matched the search words to each result.
def add_matched_dishes(items, words):
    for item in items:
        item['matched_dishes'] = []
    if not words or not items:
        return items
    condition = Q()
    for word in words:
        condition |= Q(name__icontains=word)
    found = {}
    rows = MenuItem.objects.filter(restaurant_id__in=[i['id'] for i in items]).filter(condition).order_by('name').values_list('restaurant_id', 'name')
    for restaurant_id, name in rows:
        names = found.setdefault(restaurant_id, [])
        if len(names) < 3 and name not in names:
            names.append(name)
    for item in items:
        item['matched_dishes'] = found.get(item['id'], [])
    return items


# Search restaurants by text, tags, price, rating and distance.
@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def search_restaurant(request):
    try:
        params = search.parse_search_params(request.query_params)
    except search.SearchError as error:
        return error_response(str(error), status.HTTP_400_BAD_REQUEST)

    origin, origin_name = params['origin'], None
    if params['place']:
        found, problem = look_up_place(request, params['place'])
        if problem:
            return problem
        origin, origin_name = (found[0], found[1]), found[2]

    candidates = list(search.restaurant_queryset(params))
    hours = load_hours([r.id for r in candidates])
    now = timezone.localtime()

    rows = []
    for restaurant in candidates:
        if params['open_now'] and is_open_at(hours.get(restaurant.id, {}), restaurant.is_temporarily_closed, now) is not True:
            continue
        distance = None
        if origin and restaurant.latitude is not None and restaurant.longitude is not None:
            distance = geo.haversine_km(origin[0], origin[1], restaurant.latitude, restaurant.longitude)
        if params['radius_km'] is not None and (distance is None or distance > params['radius_km']):
            continue
        rows.append((restaurant, distance))

    sort = params['sort']
    if sort == 'price_low':
        rows.sort(key=lambda row: (row[0].starting_price is None, row[0].starting_price or 0, row[0].name.lower(), row[0].id))
    elif sort == 'price_high':
        rows.sort(key=lambda row: (row[0].starting_price is None, -(row[0].starting_price or 0), row[0].name.lower(), row[0].id))
    elif sort == 'nearest':
        rows.sort(key=lambda row: (row[1] is None, row[1] or 0, row[0].name.lower(), row[0].id))

    count = len(rows)
    page, page_size = params['page'], params['page_size']
    page_rows = rows[(page - 1) * page_size: page * page_size]

    items = list(RestaurantSerializer([r for r, _ in page_rows], many=True, context={'request': request}).data)
    add_matched_dishes(hide_private(add_open_now(add_dining_info(add_menu_tags(add_rating_summary(items))), hours, now)), params['words'])
    for item, (restaurant, distance) in zip(items, page_rows):
        item['distance_km'] = None if distance is None else round(distance, 2)
        item['starting_price'] = restaurant.starting_price

    return Response({
        "count": count,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, math.ceil(count / page_size)),
        "origin": None if origin is None else {"latitude": origin[0], "longitude": origin[1], "place": origin_name},
        "results": items,
    }, status=status.HTTP_200_OK)


# List the choices for the search filters.
@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def list_filter_options(request):
    return Response({
        "cuisines": CuisineSerializer(Cuisine.objects.order_by('name'), many=True, context={'request': request}).data,
        "categories": DietaryTagSerializer(FoodCategory.objects.order_by('name'), many=True).data,
        "dietary_tags": DietaryTagSerializer(DietaryTag.objects.order_by('name'), many=True).data,
        "meal_types": [{"value": v, "label": l} for v, l in RestaurantMealType.MEAL_CHOICES],
        "dining_occasions": [{"value": v, "label": l} for v, l in RestaurantOccasion.OCCASION_CHOICES],
        "sort_options": [{"value": v, "label": search.SORT_LABELS[v], "needs_location": v == 'nearest'} for v in search.SORTS],
    }, status=status.HTTP_200_OK)


# Find a place on the map by name.
@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def find_place(request):
    text = ' '.join((request.query_params.get('q') or '').split())
    if not text:
        return error_response("q is required: the name of a place", status.HTTP_400_BAD_REQUEST)
    if len(text) > search.MAX_QUERY_LENGTH:
        return error_response(f"q can be at most {search.MAX_QUERY_LENGTH} characters", status.HTTP_400_BAD_REQUEST)
    found, problem = look_up_place(request, text)
    if problem:
        return problem
    return Response({"latitude": found[0], "longitude": found[1], "display_name": found[2]}, status=status.HTTP_200_OK)


# Work out which customer, if any, sent the request.
def who_is_asking(request):
    try:
        result = UserAuthJWTAuthentication().authenticate(request)
    except Exception:
        return None, None
    if result is None:
        return None, None
    user = result[0]
    if user.user_role != 'customer':
        return None, user.user_role
    return Customer.objects.filter(customer_email=user.user_email).first(), 'customer'


# Get the customer for favorites or a login-required response.
def customer_for_favorites(request):
    customer, role = who_is_asking(request)
    if customer:
        return customer, None
    if role is None:
        return None, Response(
            {"success": False, "login_required": True, "error": "Please log in to save restaurants to your favorites"},
            status=status.HTTP_401_UNAUTHORIZED,
        )
    return None, Response(
        {"success": False, "login_required": False, "error": "Only customers can save favorites"},
        status=status.HTTP_403_FORBIDDEN,
    )


# Say if a restaurant is saved and whether the visitor can save it.
def bookmark_info(request, restaurant):
    customer, role = who_is_asking(request)
    if customer:
        saved = BookmarkRestaurant.objects.filter(customer=customer, restaurant=restaurant).exists()
        return {"is_bookmarked": saved, "can_bookmark": True, "login_required": False}
    return {"is_bookmarked": False, "can_bookmark": False, "login_required": role is None}


# Build the restaurant cards with ratings, tags and open status.
def restaurant_cards(restaurants, request):
    items = list(RestaurantSerializer(restaurants, many=True, context={'request': request}).data)
    hours = load_hours([r.id for r in restaurants])
    return hide_private(add_open_now(add_dining_info(add_menu_tags(add_rating_summary(items))), hours, timezone.localtime()))


# Return everything for a restaurant's page.
@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def view_restaurant_details(request, restaurant_id):
    restaurant = get_object_or_404(Restaurant, id=restaurant_id)

    now = timezone.localtime()
    hours = load_hours([restaurant.id])
    base = hide_private(add_open_now(
        add_dining_info(add_menu_tags(add_rating_summary([dict(RestaurantSerializer(restaurant, context={'request': request}).data)]))),
        hours, now,
    ))[0]

    week = weekly_schedule(restaurant, hours.get(restaurant.id, {}))['hours']
    dishes = list(MenuItem.objects.filter(restaurant=restaurant).order_by('name'))
    sale_prices = [d.price for d in dishes if d.is_available and d.price and d.price > 0]

    return Response({
        "id": restaurant.id,
        "name": restaurant.name,
        "slug": restaurant.slug,
        "description": restaurant.description,
        "address": restaurant_page.address_info(restaurant),
        "map": restaurant_page.map_info(restaurant),
        "contact": {"phone": restaurant.phone_no},
        "photos": restaurant_page.photos_info(restaurant, dishes, request),
        "price": restaurant_page.price_info(restaurant, sale_prices),
        "rating": base['rating'],
        "rating_count": base['rating_count'],
        "cuisines": base['cuisines'],
        "dietary_tags": base['dietary_tags'],
        "meal_types": base['meal_types'],
        "dining_occasions": base['dining_occasions'],
        "status": {
            "is_temporarily_closed": restaurant.is_temporarily_closed,
            "opening_status": base['opening_status'],
            "is_open_now": base['is_open_now'],
        },
        "today": week[now.weekday()],
        "opening_hours": week,
        "dish_count": len(dishes),
        "available_dish_count": sum(1 for d in dishes if d.is_available),
        "bookmark": bookmark_info(request, restaurant),
    }, status=status.HTTP_200_OK)


# List a restaurant's dishes with filters.
@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def browse_menu(request, restaurant_id):
    restaurant = get_object_or_404(Restaurant, id=restaurant_id)
    try:
        wanted = restaurant_page.parse_menu_filters(request.query_params)
    except restaurant_page.MenuFilterError as error:
        return error_response(str(error), status.HTTP_400_BAD_REQUEST)

    everything = MenuItem.objects.filter(restaurant=restaurant)
    dishes = everything
    if wanted['category_ids'] or wanted['uncategorized']:
        condition = Q(category_id__in=wanted['category_ids'])
        if wanted['uncategorized']:
            condition |= Q(category__isnull=True)
        dishes = dishes.filter(condition)
    if wanted['min_price'] is not None:
        dishes = dishes.filter(price__gte=wanted['min_price'])
    if wanted['max_price'] is not None:
        dishes = dishes.filter(price__lte=wanted['max_price'])
    for slug in wanted['dietary']:
        dishes = dishes.filter(Exists(MenuItem.dietary_tags.through.objects.filter(menuitem_id=OuterRef('pk'), dietarytag__slug=slug)))
    if wanted['availability'] == 'available':
        dishes = dishes.filter(is_available=True)
    elif wanted['availability'] == 'out_of_stock':
        dishes = dishes.filter(is_available=False)

    by_category = {}
    shown = list(dishes.prefetch_related('dietary_tags', 'cuisines', 'food_categories').order_by('name'))
    for dish in add_dish_rating_summary(list(DishSerializer(shown, many=True, context=dish_context(request, shown)).data)):
        by_category.setdefault(dish['category'], []).append(dish)

    categories = list(
        MenuCategory.objects.filter(restaurant=restaurant)
        .annotate(dish_count=Count('items'))
        .order_by(F('display_order').asc(nulls_last=True), 'name')
    )
    bounds = everything.filter(price__isnull=False).aggregate(low=Min('price'), high=Max('price'))
    tag_counts = (
        MenuItem.dietary_tags.through.objects.filter(menuitem__restaurant=restaurant)
        .values('dietarytag_id', 'dietarytag__name', 'dietarytag__slug')
        .annotate(dish_count=Count('menuitem_id'))
        .order_by('dietarytag__name')
    )

    return Response({
        "restaurant": {"id": restaurant.id, "name": restaurant.name, **restaurant_status(restaurant)},
        "count": sum(len(items) for items in by_category.values()),
        "total_count": everything.count(),
        "price_bounds": {"min": bounds['low'], "max": bounds['high']},
        "filters": {
            "categories": [{"id": c.id, "name": c.name, "dish_count": c.dish_count} for c in categories],
            "uncategorized_count": everything.filter(category__isnull=True).count(),
            "dietary_tags": [{"id": t['dietarytag_id'], "name": t['dietarytag__name'], "slug": t['dietarytag__slug'], "dish_count": t['dish_count']} for t in tag_counts],
            "availability": list(restaurant_page.AVAILABILITY_CHOICES),
        },
        "categories": [
            {"id": c.id, "name": c.name, "display_order": c.display_order, "items": by_category[c.id]}
            for c in categories if c.id in by_category
        ],
        "uncategorized": by_category.get(None, []),
    }, status=status.HTTP_200_OK)


# Show one dish.
@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def view_dish(request, item_id):
    dish = get_object_or_404(MenuItem.objects.select_related('restaurant', 'category').prefetch_related('dietary_tags', 'cuisines', 'food_categories'), id=item_id)
    data = add_dish_rating_summary([dict(DishSerializer(dish, context={'request': request}).data)])[0]
    data['category_name'] = dish.category.name if dish.category else None
    restaurant = dish.restaurant
    data['restaurant'] = {"id": restaurant.id, "name": restaurant.name, "area": restaurant.area, "city": restaurant.city, **restaurant_status(restaurant)}
    return Response(data, status=status.HTTP_200_OK)


# Save a restaurant to the customer's favorites.
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def bookmark_restaurant(request, restaurant_id):
    customer, problem = customer_for_favorites(request)
    if problem:
        return problem
    restaurant = get_object_or_404(Restaurant, id=restaurant_id)
    bookmark, created = BookmarkRestaurant.objects.get_or_create(customer=customer, restaurant=restaurant)
    return Response({
        "success": True,
        "is_bookmarked": True,
        "created": created,
        "restaurant": {"id": restaurant.id, "name": restaurant.name},
        "bookmarked_at": bookmark.created_at,
    }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


# Remove a restaurant from the customer's favorites.
@api_view(['DELETE'])
@authentication_classes([])
@permission_classes([AllowAny])
def remove_bookmark(request, restaurant_id):
    customer, problem = customer_for_favorites(request)
    if problem:
        return problem
    restaurant = get_object_or_404(Restaurant, id=restaurant_id)
    removed, _ = BookmarkRestaurant.objects.filter(customer=customer, restaurant=restaurant).delete()
    return Response({
        "success": True,
        "is_bookmarked": False,
        "removed": removed > 0,
        "restaurant": {"id": restaurant.id, "name": restaurant.name},
    }, status=status.HTTP_200_OK)


# List the customer's saved restaurants.
@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def list_bookmarks(request):
    customer, problem = customer_for_favorites(request)
    if problem:
        return problem
    bookmarks = BookmarkRestaurant.objects.filter(customer=customer).select_related('restaurant').order_by('-created_at', '-id')

    # Turn saved restaurants into restaurant cards.
    def to_cards(rows):
        cards = restaurant_cards([b.restaurant for b in rows], request)
        for card, bookmark in zip(cards, rows):
            card['bookmarked_at'] = bookmark.created_at
        return cards

    ids = list(bookmarks.values_list('restaurant_id', flat=True))
    return paginated_response(request, bookmarks, to_cards, ids=ids)


MAX_COMMENT_LENGTH = 1000
MAX_REPORT_LENGTH = 1000
REVIEWS_PER_PAGE = 10


# Get the logged-in customer or a login-required response.
def customer_for(request, what):
    customer, role = who_is_asking(request)
    if customer:
        return customer, None
    if role is None:
        return None, Response(
            {"success": False, "login_required": True, "error": f"Please log in to {what}"},
            status=status.HTTP_401_UNAUTHORIZED,
        )
    return None, Response(
        {"success": False, "login_required": False, "error": f"Only customers can {what}"},
        status=status.HTTP_403_FORBIDDEN,
    )


# Delete a review with bad language and email the customer.
def reject_for_language(customer, target, rating, comment, existing):
    existing.delete()
    send_review_removed_email(customer, target, rating, comment)
    return error_response(
        "Your review was removed because it did not follow our community guidelines. We have sent you an email.",
        status.HTTP_400_BAD_REQUEST,
    )


# Turn a review into the JSON shown to visitors.
def review_card(review, mine=False):
    return {
        "id": review.id,
        "customer_name": review.customer.customer_name,
        "rating": review.rating,
        "comment": review.comment or "",
        "created_at": review.created_at,
        "updated_at": review.updated_at,
        "is_mine": mine,
    }


# Read and check the rating and comment from the request.
def read_rating_and_comment(request):
    rating = request.data.get('rating')
    if isinstance(rating, str):
        try:
            rating = float(rating.strip())
        except ValueError:
            rating = None
    if isinstance(rating, bool) or not isinstance(rating, (int, float)) or rating not in RATING_VALUES:
        return None, None, error_response("rating is required and must be from 0.5 to 5 in steps of 0.5", status.HTTP_400_BAD_REQUEST)
    rating = float(rating)

    comment = request.data.get('comment')
    if comment is None:
        comment = ""
    if not isinstance(comment, str):
        return None, None, error_response("comment must be text", status.HTTP_400_BAD_REQUEST)
    comment = comment.strip()
    if len(comment) > MAX_COMMENT_LENGTH:
        return None, None, error_response(f"comment can be at most {MAX_COMMENT_LENGTH} characters", status.HTTP_400_BAD_REQUEST)
    return rating, comment, None


# Create or update the customer's review of a restaurant.
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def create_review(request, restaurant_id):
    customer, problem = customer_for(request, "write a review")
    if problem:
        return problem
    restaurant = get_object_or_404(Restaurant, id=restaurant_id)

    rating, comment, problem = read_rating_and_comment(request)
    if problem:
        return problem

    if has_bad_language(comment):
        return reject_for_language(
            customer, restaurant.name, rating, comment,
            Review.objects.filter(customer=customer, restaurant=restaurant),
        )

    review, created = Review.objects.update_or_create(
        customer=customer, restaurant=restaurant, defaults={"rating": rating, "comment": comment},
    )
    return Response(
        {"success": True, "created": created, "review": review_card(review, mine=True)},
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )


# Delete the customer's review of a restaurant.
@api_view(['DELETE'])
@authentication_classes([])
@permission_classes([AllowAny])
def delete_review(request, restaurant_id):
    customer, problem = customer_for(request, "delete your review")
    if problem:
        return problem
    restaurant = get_object_or_404(Restaurant, id=restaurant_id)
    removed, _ = Review.objects.filter(customer=customer, restaurant=restaurant).delete()
    return Response({"success": True, "removed": removed > 0}, status=status.HTTP_200_OK)


# List the reviews of a restaurant.
@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def list_reviews(request, restaurant_id):
    restaurant = get_object_or_404(Restaurant, id=restaurant_id)
    customer, role = who_is_asking(request)

    reviews = Review.objects.filter(restaurant=restaurant)
    counts = {rating_key(value): 0 for value in RATING_VALUES}
    for row in reviews.values('rating').annotate(n=Count('id')):
        counts[rating_key(row['rating'])] = row['n']

    try:
        page = max(int(request.query_params.get('page', 1)), 1)
    except ValueError:
        page = 1
    total = sum(counts.values())
    total_pages = max(math.ceil(total / REVIEWS_PER_PAGE), 1)
    start = (page - 1) * REVIEWS_PER_PAGE
    rows = reviews.select_related('customer').order_by('-updated_at', '-id')[start:start + REVIEWS_PER_PAGE]

    mine = Review.objects.filter(customer=customer, restaurant=restaurant).select_related('customer').first() if customer else None
    return Response({
        "count": total,
        "page": page,
        "total_pages": total_pages,
        "rating_counts": counts,
        "my_review": review_card(mine, mine=True) if mine else None,
        "can_review": customer is not None,
        "login_required": role is None,
        "results": [review_card(r, mine=bool(customer) and r.customer_id == customer.id) for r in rows],
    }, status=status.HTTP_200_OK)


# Create or update the customer's review of a dish.
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def create_dish_review(request, item_id):
    customer, problem = customer_for(request, "rate a dish")
    if problem:
        return problem
    dish = get_object_or_404(MenuItem, id=item_id)
    rating, comment, problem = read_rating_and_comment(request)
    if problem:
        return problem

    if has_bad_language(comment):
        return reject_for_language(
            customer, f"{dish.name} at {dish.restaurant.name}", rating, comment,
            DishReview.objects.filter(customer=customer, menu_item=dish),
        )

    review, created = DishReview.objects.update_or_create(
        customer=customer, menu_item=dish, defaults={"rating": rating, "comment": comment},
    )
    return Response(
        {"success": True, "created": created, "review": review_card(review, mine=True)},
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )


# Delete the customer's review of a dish.
@api_view(['DELETE'])
@authentication_classes([])
@permission_classes([AllowAny])
def delete_dish_review(request, item_id):
    customer, problem = customer_for(request, "delete your review")
    if problem:
        return problem
    dish = get_object_or_404(MenuItem, id=item_id)
    removed, _ = DishReview.objects.filter(customer=customer, menu_item=dish).delete()
    return Response({"success": True, "removed": removed > 0}, status=status.HTTP_200_OK)


# List the reviews of a dish.
@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def list_dish_reviews(request, item_id):
    dish = get_object_or_404(MenuItem, id=item_id)
    customer, role = who_is_asking(request)

    reviews = DishReview.objects.filter(menu_item=dish)
    counts = {rating_key(value): 0 for value in RATING_VALUES}
    for row in reviews.values('rating').annotate(n=Count('id')):
        counts[rating_key(row['rating'])] = row['n']

    try:
        page = max(int(request.query_params.get('page', 1)), 1)
    except ValueError:
        page = 1
    total = sum(counts.values())
    total_pages = max(math.ceil(total / REVIEWS_PER_PAGE), 1)
    start = (page - 1) * REVIEWS_PER_PAGE
    rows = reviews.select_related('customer').order_by('-updated_at', '-id')[start:start + REVIEWS_PER_PAGE]

    mine = DishReview.objects.filter(customer=customer, menu_item=dish).select_related('customer').first() if customer else None
    return Response({
        "dish": {"id": dish.id, "name": dish.name},
        "count": total,
        "page": page,
        "total_pages": total_pages,
        "rating_counts": counts,
        "my_review": review_card(mine, mine=True) if mine else None,
        "can_review": customer is not None,
        "login_required": role is None,
        "results": [review_card(r, mine=bool(customer) and r.customer_id == customer.id) for r in rows],
    }, status=status.HTTP_200_OK)


# List the dish reviews of a restaurant.
@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def list_restaurant_dish_reviews(request, restaurant_id):
    restaurant = get_object_or_404(Restaurant, id=restaurant_id)
    reviews = DishReview.objects.filter(menu_item__restaurant=restaurant)

    try:
        page = max(int(request.query_params.get('page', 1)), 1)
    except ValueError:
        page = 1
    total = reviews.count()
    total_pages = max(math.ceil(total / REVIEWS_PER_PAGE), 1)
    start = (page - 1) * REVIEWS_PER_PAGE
    rows = reviews.select_related('customer', 'menu_item').order_by('-updated_at', '-id')[start:start + REVIEWS_PER_PAGE]

    return Response({
        "count": total,
        "page": page,
        "total_pages": total_pages,
        "results": [
            {**review_card(r), "dish": {"id": r.menu_item_id, "name": r.menu_item.name}}
            for r in rows
        ],
    }, status=status.HTTP_200_OK)


# List all reviews written by the logged-in customer.
@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def list_my_reviews(request):
    customer, problem = customer_for(request, "see your reviews")
    if problem:
        return problem
    # Build the restaurant details shown beside a review.
    def restaurant_info(restaurant):
        picture = restaurant.cover_image or restaurant.logo
        return {
            "id": restaurant.id, "name": restaurant.name, "area": restaurant.area, "city": restaurant.city,
            "image": request.build_absolute_uri(picture.url) if picture else None,
        }

    reviews = Review.objects.filter(customer=customer).select_related('restaurant').order_by('-updated_at', '-id')
    results = []
    for review in reviews:
        results.append({
            "id": review.id,
            "rating": review.rating,
            "comment": review.comment or "",
            "created_at": review.created_at,
            "updated_at": review.updated_at,
            "restaurant": restaurant_info(review.restaurant),
        })

    dish_results = []
    dish_reviews = DishReview.objects.filter(customer=customer).select_related('menu_item__restaurant').order_by('-updated_at', '-id')
    for review in dish_reviews:
        dish = review.menu_item
        restaurant = dish.restaurant
        dish_results.append({
            "id": review.id,
            "rating": review.rating,
            "comment": review.comment or "",
            "created_at": review.created_at,
            "updated_at": review.updated_at,
            "dish": {"id": dish.id, "name": dish.name, "image": request.build_absolute_uri(dish.image.url) if dish.image else None},
            "restaurant": restaurant_info(restaurant),
        })
    return Response(
        {"count": len(results), "results": results, "dish_count": len(dish_results), "dish_results": dish_results},
        status=status.HTTP_200_OK,
    )


# Report a restaurant.
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def create_report(request, restaurant_id):
    customer, problem = customer_for(request, "report a restaurant")
    if problem:
        return problem
    restaurant = get_object_or_404(Restaurant, id=restaurant_id)

    description = request.data.get('description')
    if not isinstance(description, str) or not description.strip():
        return error_response("description is required: tell us what is wrong", status.HTTP_400_BAD_REQUEST)
    description = description.strip()
    if len(description) > MAX_REPORT_LENGTH:
        return error_response(f"description can be at most {MAX_REPORT_LENGTH} characters", status.HTTP_400_BAD_REQUEST)

    if RestaurantReport.objects.filter(customer=customer, restaurant=restaurant, status='pending').exists():
        return error_response("You have already reported this restaurant. The admin has not looked at it yet.", status.HTTP_409_CONFLICT)

    report = RestaurantReport.objects.create(customer=customer, restaurant=restaurant, description=description)
    return Response(
        {"success": True, "message": "Thank you. Your report was sent to the admin.", "report_id": report.id},
        status=status.HTTP_201_CREATED,
    )
