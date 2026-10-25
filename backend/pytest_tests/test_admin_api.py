import pytest

from adminpanel.models import RestaurantReport
from restaurant.models import Cuisine, DietaryTag, FoodCategory, Review


def test_admin_endpoints_reject_customers(customer_client):
    for url in ('/api/admin_dashboard_stats/', '/api/list_report/', '/api/list_review/', '/api/list_cuisine/', '/api/list_customer/'):
        assert customer_client.get(url).status_code == 403, url


def test_admin_endpoints_reject_restaurants(restaurant_client):
    assert restaurant_client.get('/api/admin_dashboard_stats/').status_code == 403


def test_admin_endpoints_need_login(client, db):
    assert client.get('/api/admin_dashboard_stats/').status_code in (401, 403)


def test_dashboard_stats(admin_client, restaurant, customer):
    response = admin_client.get('/api/admin_dashboard_stats/')
    assert response.status_code == 200


def test_admin_lists_customers(admin_client, customer, other_customer):
    response = admin_client.get('/api/list_customer/')
    assert response.status_code == 200 and response.data['count'] == 2


def test_admin_can_search_customers(admin_client, customer, other_customer):
    response = admin_client.get('/api/search_customer/', {'search': 'rafi'})
    assert response.status_code == 200
    assert 'Rafi' in str(response.data) and 'Mina' not in str(response.data)


@pytest.mark.parametrize('kind, create_url, model', [
    ('cuisine', '/api/create_cuisine/', Cuisine),
    ('tag', '/api/create_dietary_tag/', DietaryTag),
    ('category', '/api/create_food_category/', FoodCategory),
])
class TestLookupTables:
    def test_create_and_reject_duplicate_ignoring_case(self, admin_client, kind, create_url, model):
        assert admin_client.post(create_url, {'name': 'Halal'}, format='json').status_code == 201
        assert admin_client.post(create_url, {'name': 'halal'}, format='json').status_code == 400
        assert model.objects.filter(name__iexact='halal').count() == 1

    def test_customers_cannot_create(self, customer_client, kind, create_url, model):
        assert customer_client.post(create_url, {'name': 'Halal'}, format='json').status_code == 403
        assert not model.objects.filter(name='Halal').exists()


def test_admin_updates_and_deletes_cuisine(admin_client):
    cuisine = Cuisine.objects.create(name='Thai')
    assert admin_client.put(f'/api/update_cuisine/{cuisine.id}/', {'name': 'Thai Food'}, format='json').status_code == 200
    cuisine.refresh_from_db()
    assert cuisine.name == 'Thai Food' and cuisine.slug == 'thai-food'
    assert admin_client.delete(f'/api/delete_cuisine/{cuisine.id}/').status_code == 200
    assert not Cuisine.objects.exists()


def test_report_flow(admin_client, customer, restaurant):
    report = RestaurantReport.objects.create(customer=customer, restaurant=restaurant, description='Closed forever')
    assert admin_client.get('/api/list_report/').data['count'] == 1
    assert admin_client.get(f'/api/view_report/{report.id}/').status_code == 200
    response = admin_client.put(f'/api/update_report_status/{report.id}/', {'status': 'resolved'}, format='json')
    assert response.status_code == 200
    report.refresh_from_db()
    assert report.status == 'resolved'
    assert admin_client.delete(f'/api/delete_report/{report.id}/').status_code == 200


def test_report_status_must_be_valid(admin_client, customer, restaurant):
    report = RestaurantReport.objects.create(customer=customer, restaurant=restaurant)
    assert admin_client.put(f'/api/update_report_status/{report.id}/', {'status': 'banana'}, format='json').status_code == 400


def test_admin_deletes_review_and_customer_is_emailed(admin_client, customer, restaurant):
    from django.core import mail
    review = Review.objects.create(customer=customer, restaurant=restaurant, rating=1, comment='meh')
    assert admin_client.get('/api/list_review/').status_code == 200
    assert admin_client.delete(f'/api/delete_review_by_admin/{review.id}/').status_code == 200
    assert not Review.objects.exists()
    assert len(mail.outbox) == 1


def test_customer_cannot_delete_reviews_as_admin(customer_client, customer, restaurant):
    review = Review.objects.create(customer=customer, restaurant=restaurant, rating=1)
    assert customer_client.delete(f'/api/delete_review_by_admin/{review.id}/').status_code == 403
    assert Review.objects.exists()


def test_admin_cannot_view_another_admins_profile(admin_client, admin_user):
    from account.models import Admin
    other = Admin.objects.create(admin_name='Other', admin_email='other@test.com', admin_password='secret123')
    assert admin_client.get(f'/api/view_admin_profile/{other.id}/').status_code == 403
    assert admin_client.get(f'/api/view_admin_profile/{admin_user.id}/').status_code == 200
