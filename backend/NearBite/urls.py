from django.contrib import admin
from django.urls import path
from django.conf import settings
from django.conf.urls.static import static
from account import views as a_views
from customer import views as c_views
from restaurant import views as r_views
from adminpanel import views as ad_views
from account.token_refresh import UserAuthTokenRefreshView

urlpatterns = [
    path('admin/', admin.site.urls),

    path('api/customer_signup/', a_views.customer_signup, name='customer_signup'),
    path('api/restaurant_request_signup/', a_views.restaurant_request_signup, name='restaurant_request_signup'),
    path('api/list_restaurant_request/', a_views.list_restaurant_request, name='list_restaurant_request'),
    path('api/requested_restaurant_info/<int:request_id>/', a_views.requested_restaurant_info, name='requested_restaurant_info'),
    path('api/process_restaurant_request/<int:request_id>/', a_views.process_restaurant_request, name='process_restaurant_request'),
    path('api/login/', a_views.login, name='login'),
    path('api/forgot_password/', a_views.forgot_password, name='forgot_password'),
    path('api/reset_password/', a_views.reset_password, name='reset_password'),

    path('api/list_customer/', c_views.list_customer, name='list_customer'),
    path('api/search_customer/', c_views.search_customer, name='search_customer'),
    path('api/view_customer_profile/<int:customer_id>/', c_views.view_customer_profile, name='view_customer_profile'),
    path('api/update_customer_profile/<int:customer_id>/', c_views.update_customer_profile, name='update_customer_profile'),
    path('api/delete_customer/<int:customer_id>/', c_views.delete_customer, name='delete_customer'),

    path('api/search_restaurant/', c_views.search_restaurant, name='search_restaurant'),
    path('api/list_filter_options/', c_views.list_filter_options, name='list_filter_options'),
    path('api/find_place/', c_views.find_place, name='find_place'),

    path('api/view_restaurant_details/<int:restaurant_id>/', c_views.view_restaurant_details, name='view_restaurant_details'),
    path('api/browse_menu/<int:restaurant_id>/', c_views.browse_menu, name='browse_menu'),
    path('api/view_dish/<int:item_id>/', c_views.view_dish, name='view_dish'),

    path('api/bookmark_restaurant/<int:restaurant_id>/', c_views.bookmark_restaurant, name='bookmark_restaurant'),
    path('api/remove_bookmark/<int:restaurant_id>/', c_views.remove_bookmark, name='remove_bookmark'),
    path('api/list_bookmarks/', c_views.list_bookmarks, name='list_bookmarks'),

    path('api/create_review/<int:restaurant_id>/', c_views.create_review, name='create_review'),
    path('api/delete_review/<int:restaurant_id>/', c_views.delete_review, name='delete_review'),
    path('api/list_my_reviews/', c_views.list_my_reviews, name='list_my_reviews'),
    path('api/create_dish_review/<int:item_id>/', c_views.create_dish_review, name='create_dish_review'),
    path('api/delete_dish_review/<int:item_id>/', c_views.delete_dish_review, name='delete_dish_review'),
    path('api/list_dish_reviews/<int:item_id>/', c_views.list_dish_reviews, name='list_dish_reviews'),
    path('api/list_restaurant_dish_reviews/<int:restaurant_id>/', c_views.list_restaurant_dish_reviews, name='list_restaurant_dish_reviews'),
    path('api/list_reviews/<int:restaurant_id>/', c_views.list_reviews, name='list_reviews'),
    path('api/create_report/<int:restaurant_id>/', c_views.create_report, name='create_report'),

    path('api/list_restaurant/', r_views.list_restaurant, name='list_restaurant'),
    path('api/view_restaurant_profile/<int:restaurant_id>/', r_views.view_restaurant_profile, name='view_restaurant_profile'),
    path('api/update_restaurant_profile/<int:restaurant_id>/', r_views.update_restaurant_profile, name='update_restaurant_profile'),
    path('api/delete_restaurant/<int:restaurant_id>/', r_views.delete_restaurant, name='delete_restaurant'),

    path('api/list_dietary_tag_options/', r_views.list_dietary_tag_options, name='list_dietary_tag_options'),
    path('api/list_cuisine_options/', r_views.list_cuisine_options, name='list_cuisine_options'),
    path('api/list_food_category_options/', r_views.list_food_category_options, name='list_food_category_options'),
    path('api/create_menu_category/', r_views.create_menu_category, name='create_menu_category'),
    path('api/list_menu_category/', r_views.list_menu_category, name='list_menu_category'),
    path('api/update_menu_category/<int:category_id>/', r_views.update_menu_category, name='update_menu_category'),
    path('api/delete_menu_category/<int:category_id>/', r_views.delete_menu_category, name='delete_menu_category'),
    path('api/create_menu_item/', r_views.create_menu_item, name='create_menu_item'),
    path('api/list_menu_item/', r_views.list_menu_item, name='list_menu_item'),
    path('api/view_menu_item/<int:item_id>/', r_views.view_menu_item, name='view_menu_item'),
    path('api/update_menu_item/<int:item_id>/', r_views.update_menu_item, name='update_menu_item'),
    path('api/delete_menu_item/<int:item_id>/', r_views.delete_menu_item, name='delete_menu_item'),
    path('api/update_menu_item_availability/<int:item_id>/', r_views.update_menu_item_availability, name='update_menu_item_availability'),
    path('api/update_temporary_closure/', r_views.update_temporary_closure, name='update_temporary_closure'),

    path('api/update_dining_info/', r_views.update_dining_info, name='update_dining_info'),
    path('api/locate_my_restaurant/', r_views.locate_my_restaurant, name='locate_my_restaurant'),

    path('api/create_offer/', r_views.create_offer, name='create_offer'),
    path('api/list_offer/', r_views.list_offer, name='list_offer'),
    path('api/update_offer/<int:offer_id>/', r_views.update_offer, name='update_offer'),
    path('api/delete_offer/<int:offer_id>/', r_views.delete_offer, name='delete_offer'),
    path('api/list_daily_deals/', r_views.list_daily_deals, name='list_daily_deals'),
    path('api/view_offer/<int:offer_id>/', r_views.view_offer, name='view_offer'),

    path('api/update_opening_hours/', r_views.update_opening_hours, name='update_opening_hours'),
    path('api/view_opening_hours/<int:restaurant_id>/', r_views.view_opening_hours, name='view_opening_hours'),
    path('api/view_restaurant_menu/<int:restaurant_id>/', r_views.view_restaurant_menu, name='view_restaurant_menu'),

    path('api/view_admin_profile/<int:admin_id>/', ad_views.view_admin_profile, name='view_admin_profile'),
    path('api/update_admin_profile/<int:admin_id>/', ad_views.update_admin_profile, name='update_admin_profile'),
    path('api/admin_dashboard_stats/', ad_views.admin_dashboard_stats, name='admin_dashboard_stats'),
    path('api/list_report/', ad_views.list_report, name='list_report'),
    path('api/view_report/<int:report_id>/', ad_views.view_report, name='view_report'),
    path('api/update_report_status/<int:report_id>/', ad_views.update_report_status, name='update_report_status'),
    path('api/delete_report/<int:report_id>/', ad_views.delete_report, name='delete_report'),

    path('api/list_review/', ad_views.list_review, name='list_review'),
    path('api/delete_review_by_admin/<int:review_id>/', ad_views.delete_review_by_admin, name='delete_review_by_admin'),
    path('api/delete_dish_review_by_admin/<int:review_id>/', ad_views.delete_dish_review_by_admin, name='delete_dish_review_by_admin'),

    path('api/list_dietary_tag/', ad_views.list_dietary_tag, name='list_dietary_tag'),
    path('api/create_dietary_tag/', ad_views.create_dietary_tag, name='create_dietary_tag'),
    path('api/view_dietary_tag/<int:tag_id>/', ad_views.view_dietary_tag, name='view_dietary_tag'),
    path('api/update_dietary_tag/<int:tag_id>/', ad_views.update_dietary_tag, name='update_dietary_tag'),
    path('api/delete_dietary_tag/<int:tag_id>/', ad_views.delete_dietary_tag, name='delete_dietary_tag'),
    path('api/list_cuisine/', ad_views.list_cuisine, name='list_cuisine'),
    path('api/create_cuisine/', ad_views.create_cuisine, name='create_cuisine'),
    path('api/view_cuisine/<int:cuisine_id>/', ad_views.view_cuisine, name='view_cuisine'),
    path('api/update_cuisine/<int:cuisine_id>/', ad_views.update_cuisine, name='update_cuisine'),
    path('api/delete_cuisine/<int:cuisine_id>/', ad_views.delete_cuisine, name='delete_cuisine'),
    path('api/list_food_category/', ad_views.list_food_category, name='list_food_category'),
    path('api/create_food_category/', ad_views.create_food_category, name='create_food_category'),
    path('api/view_food_category/<int:category_id>/', ad_views.view_food_category, name='view_food_category'),
    path('api/update_food_category/<int:category_id>/', ad_views.update_food_category, name='update_food_category'),
    path('api/delete_food_category/<int:category_id>/', ad_views.delete_food_category, name='delete_food_category'),

    path('api/token/refresh/', UserAuthTokenRefreshView.as_view(), name='token_refresh'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
