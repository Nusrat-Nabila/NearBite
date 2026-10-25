from django.core import mail, signing

from account.models import Customer, Restaurant, RestaurantRequest, UserAuth
from account.views import RESET_SALT, password_fingerprint

SIGNUP = {
    'customer_name': 'New User', 'customer_email': 'new@test.com',
    'customer_password': 'secret123', 'confirm_password': 'secret123',
}
REQUEST = {
    'restaurant_name': 'Kebab Corner', 'restaurant_email': 'kebab@test.com', 'restaurant_phone': '01711111111',
    'restaurant_owner_name': 'Karim', 'restaurant_city': 'Dhaka', 'restaurant_area': 'Mirpur',
    'restaurant_location': 'Road 1', 'restaurant_password': 'secret123', 'confirm_password': 'secret123',
}


def test_customer_signup_creates_profile_and_login(client, db):
    response = client.post('/api/customer_signup/', SIGNUP, format='json')
    assert response.status_code == 201
    assert Customer.objects.filter(customer_email='new@test.com').exists()
    assert UserAuth.objects.filter(user_email='new@test.com', user_role='customer').exists()


def test_customer_signup_rejects_password_mismatch(client, db):
    response = client.post('/api/customer_signup/', {**SIGNUP, 'confirm_password': 'different'}, format='json')
    assert response.status_code == 400
    assert not Customer.objects.exists()


def test_customer_signup_rejects_duplicate_email(client, customer):
    response = client.post('/api/customer_signup/', {**SIGNUP, 'customer_email': 'rafi@test.com'}, format='json')
    assert response.status_code == 400


def test_login_success_returns_tokens(client, customer):
    response = client.post('/api/login/', {'email': 'rafi@test.com', 'password': 'secret123', 'role': 'customer'}, format='json')
    assert response.status_code == 200
    assert response.data['role'] == 'customer'
    assert response.data['access_token'] and response.data['refresh_token']


def test_login_wrong_password(client, customer):
    response = client.post('/api/login/', {'email': 'rafi@test.com', 'password': 'nope', 'role': 'customer'}, format='json')
    assert response.status_code == 401


def test_login_unknown_user(client, db):
    response = client.post('/api/login/', {'email': 'ghost@test.com', 'password': 'x', 'role': 'customer'}, format='json')
    assert response.status_code == 404


def test_login_requires_all_fields(client, db):
    response = client.post('/api/login/', {'email': 'a@test.com'}, format='json')
    assert response.status_code == 400


def test_login_wrong_role_is_not_found(client, customer):
    response = client.post('/api/login/', {'email': 'rafi@test.com', 'password': 'secret123', 'role': 'admin'}, format='json')
    assert response.status_code == 404


def test_protected_endpoint_needs_token(client, customer):
    response = client.get(f'/api/view_customer_profile/{customer.id}/')
    assert response.status_code in (401, 403)


def test_customer_cannot_view_another_profile(customer_client, other_customer):
    response = customer_client.get(f'/api/view_customer_profile/{other_customer.id}/')
    assert response.status_code == 403


def test_customer_can_view_own_profile(customer_client, customer):
    response = customer_client.get(f'/api/view_customer_profile/{customer.id}/')
    assert response.status_code == 200


def test_restaurant_request_signup_creates_pending_request(client, db):
    response = client.post('/api/restaurant_request_signup/', REQUEST, format='json')
    assert response.status_code == 201
    assert RestaurantRequest.objects.get(restaurant_email='kebab@test.com').status == 'pending'


def test_restaurant_request_duplicate_pending_is_blocked(client, db):
    client.post('/api/restaurant_request_signup/', REQUEST, format='json')
    response = client.post('/api/restaurant_request_signup/', REQUEST, format='json')
    assert response.status_code == 400


def test_restaurant_request_needs_email(client, db):
    response = client.post('/api/restaurant_request_signup/', {'restaurant_name': 'X'}, format='json')
    assert response.status_code == 400


def test_only_admin_can_list_requests(customer_client):
    assert customer_client.get('/api/list_restaurant_request/').status_code == 403


def test_admin_approves_request_and_restaurant_can_log_in(client, admin_client):
    client.post('/api/restaurant_request_signup/', REQUEST, format='json')
    req = RestaurantRequest.objects.get(restaurant_email='kebab@test.com')
    response = admin_client.post(f'/api/process_restaurant_request/{req.id}/', {'action': 'approve'}, format='json')
    assert response.status_code == 200
    req.refresh_from_db()
    assert req.status == 'approved'
    assert Restaurant.objects.filter(email='kebab@test.com').exists()
    login = client.post('/api/login/', {'email': 'kebab@test.com', 'password': 'secret123', 'role': 'restaurant'}, format='json')
    assert login.status_code == 200


def test_admin_declines_request_with_reason(client, admin_client):
    client.post('/api/restaurant_request_signup/', REQUEST, format='json')
    req = RestaurantRequest.objects.get(restaurant_email='kebab@test.com')
    response = admin_client.post(
        f'/api/process_restaurant_request/{req.id}/', {'action': 'decline', 'reason': 'Incomplete documents'}, format='json',
    )
    assert response.status_code == 200
    req.refresh_from_db()
    assert req.status == 'declined'
    assert req.decline_reason == 'Incomplete documents'
    assert not Restaurant.objects.filter(email='kebab@test.com').exists()


def test_decline_needs_a_reason(client, admin_client):
    client.post('/api/restaurant_request_signup/', REQUEST, format='json')
    req = RestaurantRequest.objects.get(restaurant_email='kebab@test.com')
    response = admin_client.post(f'/api/process_restaurant_request/{req.id}/', {'action': 'decline'}, format='json')
    assert response.status_code == 400


def test_request_cannot_be_processed_twice(client, admin_client):
    client.post('/api/restaurant_request_signup/', REQUEST, format='json')
    req = RestaurantRequest.objects.get(restaurant_email='kebab@test.com')
    admin_client.post(f'/api/process_restaurant_request/{req.id}/', {'action': 'approve'}, format='json')
    again = admin_client.post(f'/api/process_restaurant_request/{req.id}/', {'action': 'approve'}, format='json')
    assert again.status_code == 400


def test_forgot_password_sends_email_for_known_account(client, customer):
    response = client.post('/api/forgot_password/', {'email': 'rafi@test.com', 'role': 'customer'}, format='json')
    assert response.status_code == 200
    assert len(mail.outbox) == 1
    assert 'reset-password?token=' in mail.outbox[0].body


def test_forgot_password_sends_nothing_for_unknown_account(client, db):
    response = client.post('/api/forgot_password/', {'email': 'ghost@test.com', 'role': 'customer'}, format='json')
    assert response.status_code == 200
    assert mail.outbox == []


def test_forgot_password_rejects_invalid_role(client, db):
    response = client.post('/api/forgot_password/', {'email': 'a@test.com', 'role': 'hacker'}, format='json')
    assert response.status_code == 400


def reset_token(user_auth):
    return signing.dumps({'uid': user_auth.id, 'fp': password_fingerprint(user_auth)}, salt=RESET_SALT)


def test_reset_password_changes_password_and_link_works_once(client, customer):
    token = reset_token(UserAuth.objects.get(user_email='rafi@test.com'))
    body = {'token': token, 'new_password': 'brandnew99', 'confirm_password': 'brandnew99'}
    assert client.post('/api/reset_password/', body, format='json').status_code == 200
    login = client.post('/api/login/', {'email': 'rafi@test.com', 'password': 'brandnew99', 'role': 'customer'}, format='json')
    assert login.status_code == 200
    again = client.post('/api/reset_password/', {**body, 'new_password': 'another999', 'confirm_password': 'another999'}, format='json')
    assert again.status_code == 400


def test_reset_password_rejects_bad_token(client, db):
    body = {'token': 'garbage', 'new_password': 'brandnew99', 'confirm_password': 'brandnew99'}
    assert client.post('/api/reset_password/', body, format='json').status_code == 400


def test_reset_password_rejects_short_or_mismatched_password(client, customer):
    token = reset_token(UserAuth.objects.get(user_email='rafi@test.com'))
    short = {'token': token, 'new_password': 'abc', 'confirm_password': 'abc'}
    assert client.post('/api/reset_password/', short, format='json').status_code == 400
    mismatch = {'token': token, 'new_password': 'brandnew99', 'confirm_password': 'different99'}
    assert client.post('/api/reset_password/', mismatch, format='json').status_code == 400
