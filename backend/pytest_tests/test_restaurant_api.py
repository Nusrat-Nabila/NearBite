from restaurant.models import MenuItem, OpeningHour


def test_restaurant_can_create_dish(restaurant_client, restaurant):
    response = restaurant_client.post('/api/create_menu_item/', {'name': 'Chicken Burger', 'price': 300}, format='json')
    assert response.status_code == 201, response.content
    assert MenuItem.objects.get(name='Chicken Burger').restaurant_id == restaurant.id


def test_customer_cannot_create_dish(customer_client):
    response = customer_client.post('/api/create_menu_item/', {'name': 'Sneaky', 'price': 1}, format='json')
    assert response.status_code == 403


def test_dish_needs_a_name(restaurant_client):
    response = restaurant_client.post('/api/create_menu_item/', {'price': 300}, format='json')
    assert response.status_code == 400


def test_restaurant_lists_only_its_own_dishes(restaurant_client, dish, other_restaurant):
    MenuItem.objects.create(restaurant=other_restaurant, name='Margherita', price=500)
    response = restaurant_client.get('/api/list_menu_item/')
    assert response.status_code == 200
    names = [row['name'] for row in (response.data['results'] if isinstance(response.data, dict) else response.data)]
    assert names == ['Beef Burger']


def test_restaurant_cannot_change_another_restaurants_dish(restaurant_client, other_restaurant):
    foreign = MenuItem.objects.create(restaurant=other_restaurant, name='Margherita', price=500)
    response = restaurant_client.put(f'/api/update_menu_item/{foreign.id}/', {'name': 'Hacked'}, format='json')
    assert response.status_code == 403
    foreign.refresh_from_db()
    assert foreign.name == 'Margherita'


def test_restaurant_cannot_delete_another_restaurants_dish(restaurant_client, other_restaurant):
    foreign = MenuItem.objects.create(restaurant=other_restaurant, name='Margherita', price=500)
    assert restaurant_client.delete(f'/api/delete_menu_item/{foreign.id}/').status_code == 403
    assert MenuItem.objects.filter(id=foreign.id).exists()


def test_dish_availability_toggle(restaurant_client, dish):
    response = restaurant_client.put(f'/api/update_menu_item_availability/{dish.id}/', {'is_available': False}, format='json')
    assert response.status_code == 200
    dish.refresh_from_db()
    assert dish.is_available is False


def test_dish_availability_needs_a_value(restaurant_client, dish):
    response = restaurant_client.put(f'/api/update_menu_item_availability/{dish.id}/', {}, format='json')
    assert response.status_code == 400


def test_temporary_closure_shows_restaurant_as_closed(restaurant_client, restaurant, client):
    response = restaurant_client.put('/api/update_temporary_closure/', {'is_temporarily_closed': True}, format='json')
    assert response.status_code == 200
    assert response.data['is_open_now'] is False
    page = client.get(f'/api/view_restaurant_details/{restaurant.id}/')
    assert page.data['status']['is_open_now'] is False
    assert page.data['status']['opening_status'] == 'closed'


def test_opening_hours_are_saved_and_public(restaurant_client, restaurant, client):
    hours = [{'day_of_week': day, 'open_time': '09:00:00', 'close_time': '22:00:00'} for day in range(7)]
    assert restaurant_client.put('/api/update_opening_hours/', hours, format='json').status_code == 200
    assert OpeningHour.objects.filter(restaurant=restaurant).count() == 7
    public = client.get(f'/api/view_opening_hours/{restaurant.id}/')
    assert public.status_code == 200


def test_opening_hours_reject_equal_times(restaurant_client):
    bad = [{'day_of_week': 0, 'open_time': '09:00:00', 'close_time': '09:00:00'}]
    assert restaurant_client.put('/api/update_opening_hours/', bad, format='json').status_code == 400


def test_opening_hours_reject_missing_times_when_open(restaurant_client):
    assert restaurant_client.put('/api/update_opening_hours/', [{'day_of_week': 0}], format='json').status_code == 400


def test_opening_hours_reject_duplicate_day(restaurant_client):
    row = {'day_of_week': 1, 'open_time': '09:00:00', 'close_time': '22:00:00'}
    assert restaurant_client.put('/api/update_opening_hours/', [row, row], format='json').status_code == 400


def test_opening_hours_allow_closed_day_without_times(restaurant_client):
    assert restaurant_client.put('/api/update_opening_hours/', [{'day_of_week': 4, 'is_closed': True}], format='json').status_code == 200


def test_offer_changes_dish_price_on_menu(restaurant_client, dish, restaurant, client):
    payload = {
        'deal_title': '20% off', 'offer_type': 'percentage', 'discount_percentage': 20, 'menu_items': [dish.id],
    }
    created = restaurant_client.post('/api/create_offer/', payload, format='json')
    assert created.status_code == 201, created.content
    menu = client.get(f'/api/browse_menu/{restaurant.id}/')
    assert menu.status_code == 200
    rows = menu.data['results'] if isinstance(menu.data, dict) and 'results' in menu.data else menu.data
    flat = str(rows)
    assert '336' in flat


def test_offer_with_dish_from_another_restaurant_is_rejected(restaurant_client, other_restaurant):
    foreign = MenuItem.objects.create(restaurant=other_restaurant, name='Margherita', price=500)
    payload = {'deal_title': 'Steal', 'offer_type': 'percentage', 'discount_percentage': 20, 'menu_items': [foreign.id]}
    assert restaurant_client.post('/api/create_offer/', payload, format='json').status_code == 400


def test_offer_percentage_must_be_valid(restaurant_client, dish):
    payload = {'deal_title': 'Too good', 'offer_type': 'percentage', 'discount_percentage': 150, 'menu_items': [dish.id]}
    assert restaurant_client.post('/api/create_offer/', payload, format='json').status_code == 400


def test_dining_info_replaces_the_old_choice(restaurant_client, restaurant, client):
    body = {'meal_types': ['breakfast', 'lunch'], 'dining_occasions': ['family']}
    assert restaurant_client.put('/api/update_dining_info/', body, format='json').status_code == 200
    assert restaurant_client.put('/api/update_dining_info/', {'meal_types': ['dinner']}, format='json').status_code == 200
    page = client.get(f'/api/view_restaurant_details/{restaurant.id}/')
    assert page.data['meal_types'] == ['dinner']
    assert page.data['dining_occasions'] == ['family']


def test_dining_info_rejects_unknown_values(restaurant_client):
    assert restaurant_client.put('/api/update_dining_info/', {'meal_types': ['brunchy']}, format='json').status_code == 400


def test_menu_category_names_are_unique_per_restaurant(restaurant_client):
    assert restaurant_client.post('/api/create_menu_category/', {'name': 'Burgers'}, format='json').status_code == 201
    assert restaurant_client.post('/api/create_menu_category/', {'name': 'Burgers'}, format='json').status_code == 400


def test_public_restaurant_list_hides_private_fields(client, restaurant):
    response = client.get('/api/search_restaurant/')
    assert response.status_code == 200
    first = response.data['results'][0]
    for private in ('email', 'business_reg_id', 'owner_name'):
        assert private not in first


def test_restaurant_cannot_update_another_profile(restaurant_client, other_restaurant):
    response = restaurant_client.put(f'/api/update_restaurant_profile/{other_restaurant.id}/', {'name': 'Hacked'}, format='json')
    assert response.status_code == 403
