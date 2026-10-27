from datetime import timedelta

from django.core import mail, signing
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile

from account.models import DOCUMENT_FIELDS, Customer, Restaurant, RestaurantRequest, UserAuth
from account.status import purge_due_accounts
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


# Build a restaurant signup form that includes the four PDF documents.
def request_form(**changes):
    form = {**REQUEST, **changes}
    for kind in DOCUMENT_FIELDS:
        form.setdefault(kind, None)
        form[kind] = form[kind] or SimpleUploadedFile(f'{kind}.pdf', b'%PDF-1.4 test', content_type='application/pdf')
    return form


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
    response = client.post('/api/restaurant_request_signup/', request_form(), format='multipart')
    assert response.status_code == 201
    assert RestaurantRequest.objects.get(restaurant_email='kebab@test.com').status == 'pending'


def test_restaurant_request_duplicate_pending_is_blocked(client, db):
    client.post('/api/restaurant_request_signup/', request_form(), format='multipart')
    response = client.post('/api/restaurant_request_signup/', request_form(), format='multipart')
    assert response.status_code == 400


def test_restaurant_request_needs_email(client, db):
    response = client.post('/api/restaurant_request_signup/', {'restaurant_name': 'X'}, format='json')
    assert response.status_code == 400


def test_only_admin_can_list_requests(customer_client):
    assert customer_client.get('/api/list_restaurant_request/').status_code == 403


def test_admin_approves_request_and_restaurant_can_log_in(client, admin_client):
    client.post('/api/restaurant_request_signup/', request_form(), format='multipart')
    req = RestaurantRequest.objects.get(restaurant_email='kebab@test.com')
    response = admin_client.post(f'/api/process_restaurant_request/{req.id}/', {'action': 'approve'}, format='json')
    assert response.status_code == 200
    req.refresh_from_db()
    assert req.status == 'approved'
    assert Restaurant.objects.filter(email='kebab@test.com').exists()
    login = client.post('/api/login/', {'email': 'kebab@test.com', 'password': 'secret123', 'role': 'restaurant'}, format='json')
    assert login.status_code == 200


def test_admin_declines_request_with_reason(client, admin_client):
    client.post('/api/restaurant_request_signup/', request_form(), format='multipart')
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
    client.post('/api/restaurant_request_signup/', request_form(), format='multipart')
    req = RestaurantRequest.objects.get(restaurant_email='kebab@test.com')
    response = admin_client.post(f'/api/process_restaurant_request/{req.id}/', {'action': 'decline'}, format='json')
    assert response.status_code == 400


def test_request_cannot_be_processed_twice(client, admin_client):
    client.post('/api/restaurant_request_signup/', request_form(), format='multipart')
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


def test_signup_needs_all_four_documents(client, db):
    form = request_form()
    del form['tin_certificate']
    response = client.post('/api/restaurant_request_signup/', form, format='multipart')
    assert response.status_code == 400
    assert 'tin_certificate' in response.data


def test_signup_rejects_non_pdf_document(client, db):
    form = request_form(trade_license=SimpleUploadedFile('license.pdf', b'not a pdf', content_type='application/pdf'))
    response = client.post('/api/restaurant_request_signup/', form, format='multipart')
    assert response.status_code == 400
    assert 'trade_license' in response.data


def test_only_admin_can_open_request_documents(client, admin_client, customer_client):
    client.post('/api/restaurant_request_signup/', request_form(), format='multipart')
    req = RestaurantRequest.objects.get(restaurant_email='kebab@test.com')
    url = f'/api/request_document/{req.id}/tin_certificate/'
    assert client.get(url).status_code == 401
    assert customer_client.get(url).status_code == 403
    response = admin_client.get(url)
    assert response.status_code == 200
    assert b''.join(response.streaming_content).startswith(b'%PDF-')


def test_documents_follow_request_to_approved_restaurant(client, admin_client, customer_client):
    client.post('/api/restaurant_request_signup/', request_form(), format='multipart')
    req = RestaurantRequest.objects.get(restaurant_email='kebab@test.com')
    admin_client.post(f'/api/process_restaurant_request/{req.id}/', {'action': 'approve'}, format='json')
    restaurant = Restaurant.objects.get(email='kebab@test.com')
    url = f'/api/restaurant_document/{restaurant.id}/vat_certificate/'
    assert admin_client.get(url).status_code == 200
    assert customer_client.get(url).status_code == 403
    assert 'tin_certificate' not in client.get(f'/api/view_restaurant_profile/{restaurant.id}/').data


def test_approved_request_cannot_be_declined_afterwards(client, admin_client):
    client.post('/api/restaurant_request_signup/', request_form(), format='multipart')
    req = RestaurantRequest.objects.get(restaurant_email='kebab@test.com')
    admin_client.post(f'/api/process_restaurant_request/{req.id}/', {'action': 'approve'}, format='json')
    response = admin_client.post(
        f'/api/process_restaurant_request/{req.id}/', {'action': 'decline', 'reason': 'Oops'}, format='json',
    )
    assert response.status_code == 400
    assert Restaurant.objects.filter(email='kebab@test.com').exists()


def test_suspend_customer_emails_reason_and_blocks_login(customer, client, admin_client):
    response = admin_client.post(f'/api/set_account_status/customer/{customer.id}/', {'status': 'suspended', 'reason': 'Spam reviews'}, format='json')
    assert response.status_code == 200
    assert 'Spam reviews' in mail.outbox[-1].body
    assert 'reply to this email' in mail.outbox[-1].body
    login = client.post('/api/login/', {'email': 'rafi@test.com', 'password': 'secret123', 'role': 'customer'}, format='json')
    assert login.status_code == 403
    assert 'Spam reviews' in login.data['error']


def test_suspension_needs_a_reason(customer, admin_client):
    response = admin_client.post(f'/api/set_account_status/customer/{customer.id}/', {'status': 'suspended'}, format='json')
    assert response.status_code == 400
    customer.refresh_from_db()
    assert customer.account_status == 'active'


def test_suspended_token_stops_working_and_admin_can_reactivate(customer, client, admin_client):
    from pytest_tests.conftest import login_as
    login_as(client, 'rafi@test.com', 'customer', 'secret123')
    assert client.get(f'/api/view_customer_profile/{customer.id}/').status_code == 200
    admin_client.post(f'/api/set_account_status/customer/{customer.id}/', {'status': 'suspended', 'reason': 'Abuse'}, format='json')
    assert client.get(f'/api/view_customer_profile/{customer.id}/').status_code == 401
    admin_client.post(f'/api/set_account_status/customer/{customer.id}/', {'status': 'active'}, format='json')
    assert 'active again' in mail.outbox[-1].subject
    assert client.get(f'/api/view_customer_profile/{customer.id}/').status_code == 200


def test_suspended_restaurant_is_hidden_from_customers(client, admin_client, restaurant):
    admin_client.post(f'/api/set_account_status/restaurant/{restaurant.id}/', {'status': 'suspended', 'reason': 'Hygiene'}, format='json')
    assert client.get(f'/api/view_restaurant_profile/{restaurant.id}/').status_code == 404
    assert restaurant.id not in [item['id'] for item in client.get('/api/list_restaurant/').data['results']]
    listed = admin_client.get('/api/admin_list_restaurant/').data['results']
    assert [item['account_status'] for item in listed if item['id'] == restaurant.id] == ['suspended']


def test_only_admin_can_change_account_status(customer, customer_client):
    response = customer_client.post(f'/api/set_account_status/customer/{customer.id}/', {'status': 'suspended', 'reason': 'x'}, format='json')
    assert response.status_code == 403


def test_owner_sees_own_documents_but_not_another_restaurants(client, admin_client, customer_client):
    from pytest_tests.conftest import login_as
    client.post('/api/restaurant_request_signup/', request_form(), format='multipart')
    req = RestaurantRequest.objects.get(restaurant_email='kebab@test.com')
    admin_client.post(f'/api/process_restaurant_request/{req.id}/', {'action': 'approve'}, format='json')
    restaurant = Restaurant.objects.get(email='kebab@test.com')
    Restaurant.objects.create(name='Other', email='other@test.com', password='secret123')
    UserAuth.objects.create(user_name='Other', user_email='other@test.com', user_password='secret123', user_role='restaurant')

    login_as(client, 'kebab@test.com', 'restaurant', 'secret123')
    listing = client.get(f'/api/restaurant_documents/{restaurant.id}/')
    assert listing.status_code == 200
    assert set(listing.data['documents']) == set(DOCUMENT_FIELDS)
    assert client.get(f'/api/restaurant_document/{restaurant.id}/trade_license/').status_code == 200

    other = Restaurant.objects.get(email='other@test.com')
    assert client.get(f'/api/restaurant_documents/{other.id}/').status_code == 403
    assert customer_client.get(f'/api/restaurant_documents/{restaurant.id}/').status_code == 403


def test_disable_is_no_longer_a_status(customer, admin_client):
    response = admin_client.post(f'/api/set_account_status/customer/{customer.id}/', {'status': 'disabled', 'reason': 'x'}, format='json')
    assert response.status_code == 400


def test_delete_schedules_in_30_days_and_suspends_until_then(customer, client, admin_client):
    response = admin_client.post(f'/api/admin_delete_account/customer/{customer.id}/', {'reason': 'Fake account'}, format='json')
    assert response.status_code == 200
    customer.refresh_from_db()
    assert customer.account_status == 'suspended'
    days = (customer.scheduled_deletion_at - timezone.now()).days
    assert days in (29, 30)
    body = mail.outbox[-1].body
    assert 'within 30 days' in body and 'Fake account' in body
    assert 'cannot be activated again' in body and 'within 30 days to contact the admin' in body
    login = client.post('/api/login/', {'email': 'rafi@test.com', 'password': 'secret123', 'role': 'customer'}, format='json')
    assert login.status_code == 403
    assert 'permanently deleted' in login.data['error']


def test_admin_can_cancel_a_scheduled_deletion_by_activating(customer, admin_client):
    admin_client.post(f'/api/admin_delete_account/customer/{customer.id}/', {'reason': 'Fake account'}, format='json')
    again = admin_client.post(f'/api/admin_delete_account/customer/{customer.id}/', {'reason': 'Again'}, format='json')
    assert again.status_code == 400
    admin_client.post(f'/api/set_account_status/customer/{customer.id}/', {'status': 'active'}, format='json')
    customer.refresh_from_db()
    assert customer.account_status == 'active' and customer.scheduled_deletion_at is None


def test_account_is_really_deleted_after_30_days(customer, restaurant):
    past = timezone.now() - timedelta(minutes=1)
    Customer.objects.filter(id=customer.id).update(account_status='suspended', status_reason='Fake', scheduled_deletion_at=past)
    Restaurant.objects.filter(id=restaurant.id).update(account_status='suspended', status_reason='Fraud', scheduled_deletion_at=timezone.now() + timedelta(days=5))
    purge_due_accounts()
    assert not Customer.objects.filter(id=customer.id).exists()
    assert not UserAuth.objects.filter(user_email='rafi@test.com', user_role='customer').exists()
    assert Restaurant.objects.filter(id=restaurant.id).exists()
    assert 'permanently deleted' in mail.outbox[-1].body


def test_suspend_email_says_it_is_not_reactivated_automatically(customer, admin_client):
    admin_client.post(f'/api/set_account_status/customer/{customer.id}/', {'status': 'suspended', 'reason': 'Spam'}, format='json')
    body = mail.outbox[-1].body
    assert 'will not be reactivated automatically' in body
    assert 'reply to this email or send an email to contact the admin' in body


def test_admin_deletes_restaurant_and_delete_needs_reason(restaurant, admin_client, customer_client):
    assert admin_client.post(f'/api/admin_delete_account/restaurant/{restaurant.id}/', {}, format='json').status_code == 400
    assert customer_client.post(f'/api/admin_delete_account/restaurant/{restaurant.id}/', {'reason': 'x'}, format='json').status_code == 403
    assert admin_client.post(f'/api/admin_delete_account/restaurant/{restaurant.id}/', {'reason': 'Fraud'}, format='json').status_code == 200
    restaurant.refresh_from_db()
    assert restaurant.scheduled_deletion_at is not None


def test_owner_uploads_missing_documents_only(restaurant, client, customer_client):
    from pytest_tests.conftest import login_as
    pdf = lambda: SimpleUploadedFile('a.pdf', b'%PDF-1.4 x', content_type='application/pdf')
    login_as(client, restaurant.email, 'restaurant', 'secret123')
    url = f'/api/upload_restaurant_documents/{restaurant.id}/'
    assert client.post(url, {}, format='multipart').status_code == 400
    assert client.post(url, {'tin_certificate': SimpleUploadedFile('a.pdf', b'nope')}, format='multipart').status_code == 400
    ok = client.post(url, {'tin_certificate': pdf(), 'trade_license': pdf()}, format='multipart')
    assert ok.status_code == 200
    listed = client.get(f'/api/restaurant_documents/{restaurant.id}/').data['documents']
    assert set(listed) == {'tin_certificate', 'trade_license'}
    assert client.post(url, {'tin_certificate': pdf()}, format='multipart').status_code == 400
    assert client.post(url, {'vat_certificate': pdf()}, format='multipart').status_code == 200


def test_only_the_owner_can_upload_documents(restaurant, customer_client, admin_client):
    pdf = SimpleUploadedFile('a.pdf', b'%PDF-1.4 x', content_type='application/pdf')
    url = f'/api/upload_restaurant_documents/{restaurant.id}/'
    assert customer_client.post(url, {'tin_certificate': pdf}, format='multipart').status_code == 403
    assert admin_client.post(url, {'tin_certificate': pdf}, format='multipart').status_code == 403


def test_customer_delete_needs_name_and_password(customer, customer_client):
    url = f'/api/delete_customer/{customer.id}/'
    assert customer_client.delete(url, {}, format='json').status_code == 400
    assert customer_client.delete(url, {'name': 'Wrong', 'password': 'secret123'}, format='json').status_code == 400
    assert customer_client.delete(url, {'name': 'Rafi', 'password': 'nope'}, format='json').status_code == 400
    customer.refresh_from_db()
    assert customer.account_status == 'active' and customer.scheduled_deletion_at is None


def test_customer_delete_is_scheduled_and_login_cancels_it(customer, client, customer_client):
    response = customer_client.delete(f'/api/delete_customer/{customer.id}/', {'name': 'rafi', 'password': 'secret123'}, format='json')
    assert response.status_code == 200
    customer.refresh_from_db()
    assert customer.account_status == 'pending_deletion'
    assert (customer.scheduled_deletion_at - timezone.now()).days in (29, 30)
    assert 'in 30 days' in mail.outbox[-1].body and 'log in again' in mail.outbox[-1].body.lower()
    assert customer_client.get(f'/api/view_customer_profile/{customer.id}/').status_code == 401

    login = client.post('/api/login/', {'email': 'rafi@test.com', 'password': 'secret123', 'role': 'customer'}, format='json')
    assert login.status_code == 200
    customer.refresh_from_db()
    assert customer.account_status == 'active' and customer.scheduled_deletion_at is None
    assert 'not deleted' in mail.outbox[-1].subject


def test_customer_who_never_logs_in_again_is_deleted_after_30_days(customer, customer_client):
    customer_client.delete(f'/api/delete_customer/{customer.id}/', {'name': 'Rafi', 'password': 'secret123'}, format='json')
    Customer.objects.filter(id=customer.id).update(scheduled_deletion_at=timezone.now() - timedelta(minutes=1))
    purge_due_accounts()
    assert not Customer.objects.filter(id=customer.id).exists()
    assert not UserAuth.objects.filter(user_email='rafi@test.com', user_role='customer').exists()


def test_restaurant_delete_is_scheduled_hidden_and_login_restores_it(restaurant, client, restaurant_client):
    response = restaurant_client.delete(f'/api/delete_restaurant/{restaurant.id}/', {'name': restaurant.name, 'password': 'secret123'}, format='json')
    assert response.status_code == 200
    restaurant.refresh_from_db()
    assert restaurant.account_status == 'pending_deletion'
    assert client.get(f'/api/view_restaurant_profile/{restaurant.id}/').status_code == 404
    login = client.post('/api/login/', {'email': restaurant.email, 'password': 'secret123', 'role': 'restaurant'}, format='json')
    assert login.status_code == 200
    restaurant.refresh_from_db()
    assert restaurant.account_status == 'active'
    assert client.get(f'/api/view_restaurant_profile/{restaurant.id}/').status_code == 200


def test_someone_else_cannot_schedule_deletion(customer, other_customer, customer_client):
    response = customer_client.delete(f'/api/delete_customer/{other_customer.id}/', {'name': 'Mina', 'password': 'secret123'}, format='json')
    assert response.status_code == 403


def test_suspended_restaurant_is_hidden_everywhere_customers_look(client, customer_client, admin_client, restaurant, dish):
    from customer.models import BookmarkRestaurant
    from restaurant.models import DailyDeals
    deal = DailyDeals.objects.create(restaurant=restaurant, deal_title='Lunch', offer_type='percentage', discount_percentage=10)
    BookmarkRestaurant.objects.create(customer=Customer.objects.get(customer_email='rafi@test.com'), restaurant=restaurant)
    assert client.get(f'/api/view_dish/{dish.id}/').status_code == 200
    assert [d['id'] for d in client.get('/api/list_daily_deals/').data] == [deal.id]
    assert len(customer_client.get('/api/list_bookmarks/').data['results']) == 1

    admin_client.post(f'/api/set_account_status/restaurant/{restaurant.id}/', {'status': 'suspended', 'reason': 'Hygiene'}, format='json')

    assert client.get(f'/api/view_dish/{dish.id}/').status_code == 404
    assert client.get(f'/api/list_dish_reviews/{dish.id}/').status_code == 404
    assert client.get('/api/list_daily_deals/').data == []
    assert client.get(f'/api/view_offer/{deal.id}/').status_code == 404
    assert customer_client.get('/api/list_bookmarks/').data['results'] == []
