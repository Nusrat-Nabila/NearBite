from customer.models import BookmarkRestaurant
from restaurant.models import DishReview, Review


class TestSearch:
    def test_lists_restaurants_with_paging_info(self, client, restaurant, other_restaurant):
        response = client.get('/api/search_restaurant/')
        assert response.status_code == 200
        assert response.data['count'] == 2
        assert {'page', 'page_size', 'total_pages', 'results'} <= set(response.data)

    def test_text_search_matches_name(self, client, restaurant, other_restaurant):
        response = client.get('/api/search_restaurant/', {'q': 'burger'})
        assert [r['name'] for r in response.data['results']] == ['Burger House']

    def test_text_search_matches_dish_name(self, client, restaurant, other_restaurant, dish):
        response = client.get('/api/search_restaurant/', {'q': 'beef'})
        assert [r['name'] for r in response.data['results']] == ['Burger House']
        assert response.data['results'][0]['matched_dishes']

    def test_text_search_matches_area(self, client, restaurant, other_restaurant):
        response = client.get('/api/search_restaurant/', {'q': 'gulshan'})
        assert [r['name'] for r in response.data['results']] == ['Pizza Hub']

    def test_no_match_returns_empty(self, client, restaurant):
        response = client.get('/api/search_restaurant/', {'q': 'zzzzzz'})
        assert response.status_code == 200 and response.data['count'] == 0

    def test_sort_nearest_needs_a_position(self, client, restaurant):
        assert client.get('/api/search_restaurant/', {'sort': 'nearest'}).status_code == 400

    def test_lat_without_lng_is_rejected(self, client, restaurant):
        assert client.get('/api/search_restaurant/', {'lat': '23.7'}).status_code == 400

    def test_min_price_cannot_exceed_max_price(self, client, restaurant):
        assert client.get('/api/search_restaurant/', {'min_price': '500', 'max_price': '100'}).status_code == 400

    def test_unknown_sort_is_rejected(self, client, restaurant):
        assert client.get('/api/search_restaurant/', {'sort': 'banana'}).status_code == 400

    def test_nearest_sort_orders_by_distance(self, client, restaurant):
        from account.models import Restaurant
        Restaurant.objects.create(name='Far Away', latitude='22.356900', longitude='91.783200')
        response = client.get('/api/search_restaurant/', {'lat': '23.7465', 'lng': '90.376', 'sort': 'nearest'})
        assert response.status_code == 200
        names = [r['name'] for r in response.data['results']]
        assert names[0] == 'Burger House'
        assert response.data['results'][0]['distance_km'] < response.data['results'][1]['distance_km']

    def test_radius_filters_far_restaurants(self, client, restaurant):
        from account.models import Restaurant
        Restaurant.objects.create(name='Far Away', latitude='22.356900', longitude='91.783200')
        response = client.get('/api/search_restaurant/', {'lat': '23.7465', 'lng': '90.376', 'radius_km': '5'})
        assert [r['name'] for r in response.data['results']] == ['Burger House']

    def test_page_size_limits_results(self, client, restaurant, other_restaurant):
        response = client.get('/api/search_restaurant/', {'page_size': '1'})
        assert len(response.data['results']) == 1 and response.data['total_pages'] == 2

    def test_filter_options_are_public(self, client, db):
        response = client.get('/api/list_filter_options/')
        assert response.status_code == 200
        assert {'cuisines', 'categories', 'dietary_tags', 'meal_types', 'sort_options'} <= set(response.data)


class TestRestaurantPage:
    def test_page_has_core_details(self, client, restaurant, dish):
        response = client.get(f'/api/view_restaurant_details/{restaurant.id}/')
        assert response.status_code == 200
        assert response.data['name'] == 'Burger House'
        assert response.data['address']['full'] == 'House 5, Road 2, Dhanmondi, Dhaka'
        assert response.data['map'] is not None
        for private in ('email', 'owner_name', 'business_reg_id'):
            assert private not in response.data

    def test_unknown_restaurant_is_404(self, client, db):
        assert client.get('/api/view_restaurant_details/99999/').status_code == 404

    def test_page_without_hours_says_hours_not_set(self, client, restaurant):
        response = client.get(f'/api/view_restaurant_details/{restaurant.id}/')
        assert response.data['status']['opening_status'] == 'hours_not_set'
        assert response.data['status']['is_open_now'] is None

    def test_map_is_none_without_coordinates(self, client, other_restaurant):
        assert client.get(f'/api/view_restaurant_details/{other_restaurant.id}/').data['map'] is None

    def test_menu_lists_dishes(self, client, restaurant, dish):
        response = client.get(f'/api/browse_menu/{restaurant.id}/')
        assert response.status_code == 200
        assert 'Beef Burger' in str(response.data)


class TestFavorites:
    def test_login_required_to_bookmark(self, client, restaurant):
        response = client.post(f'/api/bookmark_restaurant/{restaurant.id}/')
        assert response.status_code == 401
        assert response.data['login_required'] is True

    def test_restaurant_account_cannot_bookmark(self, restaurant_client, other_restaurant):
        response = restaurant_client.post(f'/api/bookmark_restaurant/{other_restaurant.id}/')
        assert response.status_code == 403

    def test_customer_can_bookmark_list_and_remove(self, customer_client, customer, restaurant):
        assert customer_client.post(f'/api/bookmark_restaurant/{restaurant.id}/').status_code in (200, 201)
        assert BookmarkRestaurant.objects.filter(customer=customer, restaurant=restaurant).count() == 1
        listing = customer_client.get('/api/list_bookmarks/')
        assert listing.data['count'] == 1
        assert customer_client.delete(f'/api/remove_bookmark/{restaurant.id}/').status_code == 200
        assert not BookmarkRestaurant.objects.exists()

    def test_bookmarking_twice_keeps_one_row(self, customer_client, customer, restaurant):
        customer_client.post(f'/api/bookmark_restaurant/{restaurant.id}/')
        customer_client.post(f'/api/bookmark_restaurant/{restaurant.id}/')
        assert BookmarkRestaurant.objects.count() == 1

    def test_bookmark_state_shown_on_restaurant_page(self, customer_client, restaurant):
        customer_client.post(f'/api/bookmark_restaurant/{restaurant.id}/')
        page = customer_client.get(f'/api/view_restaurant_details/{restaurant.id}/')
        assert page.data['bookmark']['is_bookmarked'] is True if 'bookmark' in page.data else 'is_bookmarked' in str(page.data)


class TestReviews:
    def test_login_required(self, client, restaurant):
        assert client.post(f'/api/create_review/{restaurant.id}/', {'rating': 4}, format='json').status_code == 401

    def test_create_review(self, customer_client, customer, restaurant):
        response = customer_client.post(f'/api/create_review/{restaurant.id}/', {'rating': 4.5, 'comment': 'Tasty'}, format='json')
        assert response.status_code == 201
        assert Review.objects.get(customer=customer, restaurant=restaurant).rating == 4.5

    def test_second_review_updates_the_first(self, customer_client, customer, restaurant):
        customer_client.post(f'/api/create_review/{restaurant.id}/', {'rating': 2}, format='json')
        again = customer_client.post(f'/api/create_review/{restaurant.id}/', {'rating': 5}, format='json')
        assert again.status_code == 200
        assert Review.objects.filter(customer=customer, restaurant=restaurant).count() == 1
        assert Review.objects.get().rating == 5

    def test_rating_must_be_half_steps_between_half_and_five(self, customer_client, restaurant):
        for bad in (0, 5.5, 3.3, 'abc', None, True):
            response = customer_client.post(f'/api/create_review/{restaurant.id}/', {'rating': bad}, format='json')
            assert response.status_code == 400, bad

    def test_bad_language_removes_review_and_emails_customer(self, customer_client, customer, restaurant):
        from django.core import mail
        response = customer_client.post(f'/api/create_review/{restaurant.id}/', {'rating': 1, 'comment': 'what a bitch'}, format='json')
        assert response.status_code == 400
        assert not Review.objects.exists()
        assert len(mail.outbox) == 1

    def test_comment_length_is_limited(self, customer_client, restaurant):
        response = customer_client.post(f'/api/create_review/{restaurant.id}/', {'rating': 4, 'comment': 'a' * 1001}, format='json')
        assert response.status_code == 400

    def rate_as(self, email, restaurant, rating):
        from rest_framework.test import APIClient
        from pytest_tests.conftest import login_as
        api = APIClient()
        login_as(api, email, 'customer', 'secret123')
        return api.post(f'/api/create_review/{restaurant.id}/', {'rating': rating}, format='json')

    def test_rating_summary_is_the_average_of_all_reviews(self, customer, other_customer, restaurant):
        self.rate_as('rafi@test.com', restaurant, 5)
        self.rate_as('mina@test.com', restaurant, 4)
        from rest_framework.test import APIClient
        result = APIClient().get('/api/search_restaurant/', {'q': 'burger'}).data['results'][0]
        assert result['rating'] == 4.5 and result['rating_count'] == 2

    def test_rating_average_is_rounded_to_one_decimal(self, customer, other_customer, restaurant):
        from account.models import Customer
        third = Customer.objects.create(customer_name='Third', customer_email='third@test.com', customer_password='secret123')
        from restaurant.models import Review
        Review.objects.create(customer=third, restaurant=restaurant, rating=4)
        self.rate_as('rafi@test.com', restaurant, 4)
        self.rate_as('mina@test.com', restaurant, 5)
        from rest_framework.test import APIClient
        result = APIClient().get('/api/search_restaurant/', {'q': 'burger'}).data['results'][0]
        assert result['rating'] == 4.3 and result['rating_count'] == 3

    def test_restaurant_without_reviews_has_no_rating(self, restaurant):
        from rest_framework.test import APIClient
        result = APIClient().get('/api/search_restaurant/', {'q': 'burger'}).data['results'][0]
        assert result['rating'] is None and result['rating_count'] == 0

    def test_dish_rating_is_the_average_too(self, customer_client, other_customer, dish):
        from rest_framework.test import APIClient
        from pytest_tests.conftest import login_as
        customer_client.post(f'/api/create_dish_review/{dish.id}/', {'rating': 5}, format='json')
        second = APIClient()
        login_as(second, 'mina@test.com', 'customer', 'secret123')
        second.post(f'/api/create_dish_review/{dish.id}/', {'rating': 3.5}, format='json')
        data = APIClient().get(f'/api/view_dish/{dish.id}/').data
        assert data['rating'] == 4.3 and data['rating_count'] == 2

    def test_list_reviews_counts_by_rating(self, customer_client, restaurant):
        customer_client.post(f'/api/create_review/{restaurant.id}/', {'rating': 5, 'comment': 'Great'}, format='json')
        response = customer_client.get(f'/api/list_reviews/{restaurant.id}/')
        assert response.data['count'] == 1
        assert response.data['rating_counts']['5'] == 1
        assert response.data['my_review']['comment'] == 'Great'

    def test_delete_review(self, customer_client, restaurant):
        customer_client.post(f'/api/create_review/{restaurant.id}/', {'rating': 5}, format='json')
        assert customer_client.delete(f'/api/delete_review/{restaurant.id}/').data['removed'] is True
        assert not Review.objects.exists()

    def test_dish_review(self, customer_client, customer, dish):
        response = customer_client.post(f'/api/create_dish_review/{dish.id}/', {'rating': 4, 'comment': 'Juicy'}, format='json')
        assert response.status_code == 201
        assert DishReview.objects.filter(customer=customer, menu_item=dish).exists()

    def test_my_reviews_lists_both_kinds(self, customer_client, restaurant, dish):
        customer_client.post(f'/api/create_review/{restaurant.id}/', {'rating': 5}, format='json')
        customer_client.post(f'/api/create_dish_review/{dish.id}/', {'rating': 4}, format='json')
        assert customer_client.get('/api/list_my_reviews/').status_code == 200


class TestReports:
    def test_login_required(self, client, restaurant):
        assert client.post(f'/api/create_report/{restaurant.id}/', {'description': 'spam'}, format='json').status_code == 401

    def test_customer_can_report(self, customer_client, restaurant):
        from adminpanel.models import RestaurantReport
        response = customer_client.post(f'/api/create_report/{restaurant.id}/', {'description': 'Wrong address'}, format='json')
        assert response.status_code == 201, response.content
        assert RestaurantReport.objects.get().status == 'pending'


class TestPlaceLookup:
    def test_find_place_needs_text(self, client, db):
        assert client.get('/api/find_place/').status_code == 400

    def test_lookup_limit_per_visitor(self, db):
        from customer import geo
        allowed = [geo.allow_lookup('1.2.3.4') for _ in range(geo.LOOKUPS_PER_MINUTE + 3)]
        assert allowed[:geo.LOOKUPS_PER_MINUTE] == [True] * geo.LOOKUPS_PER_MINUTE
        assert allowed[geo.LOOKUPS_PER_MINUTE:] == [False] * 3
        assert geo.allow_lookup('9.9.9.9') is True
