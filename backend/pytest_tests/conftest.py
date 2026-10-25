# Shared pytest fixtures for the backend test suite.
import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from account.models import Admin, Customer, Restaurant, UserAuth
from restaurant.models import MenuItem


@pytest.fixture(autouse=True)
def clean_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def client():
    return APIClient()


def login_as(client, email, role, password):
    response = client.post('/api/login/', {'email': email, 'password': password, 'role': role}, format='json')
    assert response.status_code == 200, response.content
    client.credentials(HTTP_AUTHORIZATION='Bearer ' + response.data['access_token'])
    return response


@pytest.fixture
def customer(db):
    user = Customer.objects.create(customer_name='Rafi', customer_email='rafi@test.com', customer_password='secret123')
    UserAuth.objects.create(user_name='Rafi', user_email='rafi@test.com', user_password='secret123', user_role='customer')
    return user


@pytest.fixture
def other_customer(db):
    user = Customer.objects.create(customer_name='Mina', customer_email='mina@test.com', customer_password='secret123')
    UserAuth.objects.create(user_name='Mina', user_email='mina@test.com', user_password='secret123', user_role='customer')
    return user


@pytest.fixture
def restaurant(db):
    place = Restaurant.objects.create(
        name='Burger House', email='burger@test.com', password='secret123',
        city='Dhaka', area='Dhanmondi', location='House 5, Road 2',
        latitude='23.746500', longitude='90.376000',
    )
    UserAuth.objects.create(user_name='Burger House', user_email='burger@test.com', user_password='secret123', user_role='restaurant')
    return place


@pytest.fixture
def other_restaurant(db):
    place = Restaurant.objects.create(name='Pizza Hub', email='pizza@test.com', password='secret123', city='Dhaka', area='Gulshan')
    UserAuth.objects.create(user_name='Pizza Hub', user_email='pizza@test.com', user_password='secret123', user_role='restaurant')
    return place


@pytest.fixture
def admin_user(db):
    user = Admin.objects.create(admin_name='Boss', admin_email='admin@test.com', admin_password='secret123')
    UserAuth.objects.create(user_name='Boss', user_email='admin@test.com', user_password='secret123', user_role='admin')
    return user


@pytest.fixture
def dish(restaurant):
    return MenuItem.objects.create(restaurant=restaurant, name='Beef Burger', price=420, is_available=True)


@pytest.fixture
def customer_client(customer):
    api = APIClient()
    login_as(api, 'rafi@test.com', 'customer', 'secret123')
    return api


@pytest.fixture
def restaurant_client(restaurant):
    api = APIClient()
    login_as(api, 'burger@test.com', 'restaurant', 'secret123')
    return api


@pytest.fixture
def admin_client(admin_user):
    api = APIClient()
    login_as(api, 'admin@test.com', 'admin', 'secret123')
    return api
