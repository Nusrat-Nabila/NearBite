from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from account.models import Admin, Customer, Restaurant, RestaurantRequest
from account.pagination import paginated_response
from account.serializers import AdminSerializer, RestaurantSerializer
from account.views import is_admin, is_owner, admin_only_response, not_authorized_response, sync_user_auth
from restaurant.models import RATING_VALUES, DietaryTag, Cuisine, FoodCategory, DishReview, Review
from restaurant.moderation import send_review_removed_email
from .models import RestaurantReport
from .serializers import DietaryTagAdminSerializer, CuisineAdminSerializer, FoodCategoryAdminSerializer, RestaurantReportAdminSerializer


# Show the logged-in admin's profile.
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def view_admin_profile(request, admin_id):
    admin = get_object_or_404(Admin, id=admin_id)
    if not is_owner(request.user, "admin", admin.admin_email):
        return not_authorized_response()
    serializer = AdminSerializer(admin)
    return Response(serializer.data, status=status.HTTP_200_OK)


# Update the logged-in admin's profile.
@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_admin_profile(request, admin_id):
    admin = get_object_or_404(Admin, id=admin_id)
    if not is_owner(request.user, "admin", admin.admin_email):
        return not_authorized_response()

    old_email = admin.admin_email
    serializer = AdminSerializer(admin, data=request.data, partial=True)
    if serializer.is_valid():
        admin = serializer.save()
        sync_user_auth(old_email, "admin", admin.admin_name, admin.admin_email, admin.admin_password)
        return Response(serializer.data, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# List every restaurant, including suspended and disabled ones, for the admin.
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_list_restaurant(request):
    if not is_admin(request.user):
        return admin_only_response()
    restaurants = Restaurant.objects.all().order_by('name', 'id')
    return paginated_response(request, restaurants, lambda rows: RestaurantSerializer(rows, many=True, context={'request': request}).data)


# List all dietary tags.
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_dietary_tag(request):
    if not is_admin(request.user):
        return admin_only_response()
    tags = DietaryTag.objects.all().order_by('name')
    serializer = DietaryTagAdminSerializer(tags, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


# Create a dietary tag.
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_dietary_tag(request):
    if not is_admin(request.user):
        return admin_only_response()
    serializer = DietaryTagAdminSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response({"success": True, "data": serializer.data}, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# Show one dietary tag.
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def view_dietary_tag(request, tag_id):
    if not is_admin(request.user):
        return admin_only_response()
    tag = get_object_or_404(DietaryTag, id=tag_id)
    serializer = DietaryTagAdminSerializer(tag)
    return Response(serializer.data, status=status.HTTP_200_OK)


# Update a dietary tag.
@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_dietary_tag(request, tag_id):
    if not is_admin(request.user):
        return admin_only_response()
    tag = get_object_or_404(DietaryTag, id=tag_id)
    serializer = DietaryTagAdminSerializer(tag, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# Delete a dietary tag.
@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_dietary_tag(request, tag_id):
    if not is_admin(request.user):
        return admin_only_response()
    tag = get_object_or_404(DietaryTag, id=tag_id)
    used_by = tag.menu_items.count()
    if used_by:
        return Response(
            {
                "success": False,
                "error": f"Cannot delete dietary tag '{tag.name}': it is used by {used_by} menu item(s). Remove it from them first.",
                "menu_item_count": used_by,
            },
            status=status.HTTP_400_BAD_REQUEST
        )
    tag.delete()
    return Response({"message": "Dietary tag deleted successfully"}, status=status.HTTP_200_OK)


# List all cuisines.
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_cuisine(request):
    if not is_admin(request.user):
        return admin_only_response()
    cuisines = Cuisine.objects.all().order_by('name')
    serializer = CuisineAdminSerializer(cuisines, many=True, context={'request': request})
    return Response(serializer.data, status=status.HTTP_200_OK)


# Create a cuisine.
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_cuisine(request):
    if not is_admin(request.user):
        return admin_only_response()
    serializer = CuisineAdminSerializer(data=request.data, context={'request': request})
    if serializer.is_valid():
        serializer.save()
        return Response({"success": True, "data": serializer.data}, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# Show one cuisine.
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def view_cuisine(request, cuisine_id):
    if not is_admin(request.user):
        return admin_only_response()
    cuisine = get_object_or_404(Cuisine, id=cuisine_id)
    serializer = CuisineAdminSerializer(cuisine, context={'request': request})
    return Response(serializer.data, status=status.HTTP_200_OK)


# Update a cuisine.
@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_cuisine(request, cuisine_id):
    if not is_admin(request.user):
        return admin_only_response()
    cuisine = get_object_or_404(Cuisine, id=cuisine_id)
    serializer = CuisineAdminSerializer(cuisine, data=request.data, partial=True, context={'request': request})
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# Delete a cuisine.
@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_cuisine(request, cuisine_id):
    if not is_admin(request.user):
        return admin_only_response()
    cuisine = get_object_or_404(Cuisine, id=cuisine_id)
    used_by = cuisine.menu_items.count()
    if used_by:
        return Response(
            {
                "success": False,
                "error": f"Cannot delete cuisine '{cuisine.name}': it is used by {used_by} menu item(s). Remove it from them first.",
                "menu_item_count": used_by,
            },
            status=status.HTTP_400_BAD_REQUEST
        )
    cuisine.delete()
    return Response({"message": "Cuisine deleted successfully"}, status=status.HTTP_200_OK)


# List all food categories.
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_food_category(request):
    if not is_admin(request.user):
        return admin_only_response()
    categories = FoodCategory.objects.all().order_by('name')
    serializer = FoodCategoryAdminSerializer(categories, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


# Create a food category.
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_food_category(request):
    if not is_admin(request.user):
        return admin_only_response()
    serializer = FoodCategoryAdminSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response({"success": True, "data": serializer.data}, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# Show one food category.
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def view_food_category(request, category_id):
    if not is_admin(request.user):
        return admin_only_response()
    category = get_object_or_404(FoodCategory, id=category_id)
    return Response(FoodCategoryAdminSerializer(category).data, status=status.HTTP_200_OK)


# Update a food category.
@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_food_category(request, category_id):
    if not is_admin(request.user):
        return admin_only_response()
    category = get_object_or_404(FoodCategory, id=category_id)
    serializer = FoodCategoryAdminSerializer(category, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# Delete a food category.
@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_food_category(request, category_id):
    if not is_admin(request.user):
        return admin_only_response()
    category = get_object_or_404(FoodCategory, id=category_id)
    used_by = category.menu_items.count()
    if used_by:
        return Response(
            {
                "success": False,
                "error": f"Cannot delete category '{category.name}': it is used by {used_by} menu item(s). Remove it from them first.",
                "menu_item_count": used_by,
            },
            status=status.HTTP_400_BAD_REQUEST
        )
    category.delete()
    return Response({"message": "Category deleted successfully"}, status=status.HTTP_200_OK)


# Return the totals shown on the admin dashboard.
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_dashboard_stats(request):
    if not is_admin(request.user):
        return admin_only_response()
    return Response({
        "total_customers": Customer.objects.count(),
        "total_restaurants": Restaurant.objects.count(),
        "pending_restaurant_requests": RestaurantRequest.objects.filter(status='pending').count(),
        "pending_reports": RestaurantReport.objects.filter(status='pending').count(),
    }, status=status.HTTP_200_OK)


# List restaurant reports with filters.
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_report(request):
    if not is_admin(request.user):
        return admin_only_response()

    reports = RestaurantReport.objects.select_related('customer', 'restaurant').order_by('-created_at', '-id')

    wanted = (request.query_params.get('status') or '').strip().lower()
    if wanted:
        if wanted not in dict(RestaurantReport.STATUS_CHOICES):
            return Response(
                {"success": False, "error": "Invalid status. Use pending, reviewed, resolved or dismissed."},
                status=status.HTTP_400_BAD_REQUEST
            )
        reports = reports.filter(status=wanted)

    return paginated_response(request, reports, lambda rows: RestaurantReportAdminSerializer(rows, many=True).data)


# Show one restaurant report.
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def view_report(request, report_id):
    if not is_admin(request.user):
        return admin_only_response()
    report = get_object_or_404(RestaurantReport.objects.select_related('customer', 'restaurant'), id=report_id)
    serializer = RestaurantReportAdminSerializer(report)
    return Response(serializer.data, status=status.HTTP_200_OK)


# Change the status of a report.
@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_report_status(request, report_id):
    if not is_admin(request.user):
        return admin_only_response()
    report = get_object_or_404(RestaurantReport.objects.select_related('customer', 'restaurant'), id=report_id)

    if 'status' not in request.data:
        return Response({"success": False, "error": "Status is required"}, status=status.HTTP_400_BAD_REQUEST)

    serializer = RestaurantReportAdminSerializer(report, data={"status": request.data.get("status")}, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# Turn a restaurant review into a row for the admin list.
def review_row(review):
    return {
        "type": "restaurant",
        "id": review.id,
        "customer": review.customer_id,
        "customer_name": review.customer.customer_name,
        "restaurant": review.restaurant_id,
        "restaurant_name": review.restaurant.name,
        "rating": review.rating,
        "comment": review.comment or "",
        "created_at": review.created_at,
        "updated_at": review.updated_at,
    }


# Turn a dish review into a row for the admin list.
def dish_review_row(review):
    dish = review.menu_item
    return {
        "type": "dish",
        "id": review.id,
        "customer": review.customer_id,
        "customer_name": review.customer.customer_name,
        "dish": dish.id,
        "dish_name": dish.name,
        "restaurant": dish.restaurant_id,
        "restaurant_name": dish.restaurant.name,
        "rating": review.rating,
        "comment": review.comment or "",
        "created_at": review.created_at,
        "updated_at": review.updated_at,
    }


# List restaurant and dish reviews for the admin.
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_review(request):
    if not is_admin(request.user):
        return admin_only_response()

    kind = (request.query_params.get('type') or '').strip().lower()
    if kind not in ('', 'restaurant', 'dish'):
        return Response({"success": False, "error": "type must be restaurant or dish"}, status=status.HTTP_400_BAD_REQUEST)

    reviews = Review.objects.select_related('customer', 'restaurant').order_by('-updated_at', '-id')
    dish_reviews = DishReview.objects.select_related('customer', 'menu_item__restaurant').order_by('-updated_at', '-id')

    rating = (request.query_params.get('rating') or '').strip()
    if rating:
        try:
            rating_value = float(rating)
        except ValueError:
            rating_value = None
        if rating_value not in RATING_VALUES:
            return Response({"success": False, "error": "rating must be from 0.5 to 5 in steps of 0.5"}, status=status.HTTP_400_BAD_REQUEST)
        reviews = reviews.filter(rating=rating_value)
        dish_reviews = dish_reviews.filter(rating=rating_value)

    restaurant = (request.query_params.get('restaurant') or '').strip()
    if restaurant:
        if not restaurant.isdigit() or int(restaurant) > 9_223_372_036_854_775_807:
            return Response({"success": False, "error": "restaurant must be a restaurant id"}, status=status.HTTP_400_BAD_REQUEST)
        reviews = reviews.filter(restaurant_id=int(restaurant))
        dish_reviews = dish_reviews.filter(menu_item__restaurant_id=int(restaurant))

    rows = []
    if kind in ('', 'restaurant'):
        rows += [(r.updated_at, review_row(r)) for r in reviews]
    if kind in ('', 'dish'):
        rows += [(r.updated_at, dish_review_row(r)) for r in dish_reviews]
    rows.sort(key=lambda row: row[0], reverse=True)
    return paginated_response(request, [row for _, row in rows])


# Delete a dish review as admin.
@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_dish_review_by_admin(request, review_id):
    if not is_admin(request.user):
        return admin_only_response()
    review = get_object_or_404(DishReview.objects.select_related('customer', 'menu_item__restaurant'), id=review_id)
    customer, rating, comment = review.customer, review.rating, review.comment
    target = f"{review.menu_item.name} at {review.menu_item.restaurant.name}"
    review.delete()
    send_review_removed_email(customer, target, rating, comment)
    return Response({"message": "Review deleted successfully"}, status=status.HTTP_200_OK)


# Delete a restaurant review as admin.
@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_review_by_admin(request, review_id):
    if not is_admin(request.user):
        return admin_only_response()
    review = get_object_or_404(Review.objects.select_related('customer', 'restaurant'), id=review_id)
    customer, rating, comment = review.customer, review.rating, review.comment
    target = review.restaurant.name
    review.delete()
    send_review_removed_email(customer, target, rating, comment)
    return Response({"message": "Review deleted successfully"}, status=status.HTTP_200_OK)


# Delete a report.
@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_report(request, report_id):
    if not is_admin(request.user):
        return admin_only_response()
    report = get_object_or_404(RestaurantReport, id=report_id)
    report.delete()
    return Response({"message": "Report deleted successfully"}, status=status.HTTP_200_OK)
