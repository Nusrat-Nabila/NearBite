from datetime import date, datetime, time, timedelta
from types import SimpleNamespace

import pytest
from django.utils import timezone

from account.pagination import PageError, page_params
from customer.geo import haversine_km
from restaurant.deals import best_item_deals, deal_status, item_pricing, status_filter
from restaurant.models import DailyDeals, rating_key
from restaurant.moderation import has_bad_language
from restaurant.views import is_open_at

TODAY = date(2026, 6, 10)


def deal(**kwargs):
    defaults = dict(is_active=True, start_date=None, end_date=None)
    return SimpleNamespace(**{**defaults, **kwargs})


def hour(open_time, close_time, is_closed=False):
    return SimpleNamespace(open_time=open_time, close_time=close_time, is_closed=is_closed)


def at(weekday, clock):
    monday = datetime(2026, 6, 8)
    return monday + timedelta(days=weekday, hours=clock.hour, minutes=clock.minute)


class TestDealStatus:
    def test_paused_when_not_active(self):
        assert deal_status(deal(is_active=False), TODAY) == 'paused'

    def test_scheduled_before_start(self):
        assert deal_status(deal(start_date=TODAY + timedelta(days=1)), TODAY) == 'scheduled'

    def test_expired_after_end(self):
        assert deal_status(deal(end_date=TODAY - timedelta(days=1)), TODAY) == 'expired'

    def test_active_without_dates(self):
        assert deal_status(deal(), TODAY) == 'active'

    def test_active_on_first_and_last_day(self):
        assert deal_status(deal(start_date=TODAY, end_date=TODAY), TODAY) == 'active'

    def test_paused_wins_over_dates(self):
        assert deal_status(deal(is_active=False, end_date=TODAY - timedelta(days=5)), TODAY) == 'paused'

    def test_unknown_status_filter_raises(self):
        with pytest.raises(ValueError):
            status_filter('nonsense', TODAY)


@pytest.mark.django_db
class TestDealFilterMatchesStatus:
    def test_database_filter_agrees_with_python_rules(self, restaurant):
        cases = {
            'paused': dict(is_active=False),
            'scheduled': dict(start_date=TODAY + timedelta(days=2)),
            'expired': dict(end_date=TODAY - timedelta(days=2)),
            'active': dict(start_date=TODAY - timedelta(days=1), end_date=TODAY + timedelta(days=1)),
        }
        for name, extra in cases.items():
            DailyDeals.objects.create(restaurant=restaurant, deal_title=name, offer_type='percentage', discount_percentage=10, **extra)
        for name in cases:
            found = DailyDeals.objects.filter(status_filter(name, TODAY))
            assert [d.deal_title for d in found] == [name]
            assert all(deal_status(d, TODAY) == name for d in found)


class TestItemPricing:
    def item(self, price, old_price=None):
        return SimpleNamespace(price=price, old_price=old_price)

    def test_no_discount(self):
        result = item_pricing(self.item(420))
        assert result == {'original_price': None, 'final_price': 420, 'discount_percent': None, 'discount_source': None}

    def test_percentage_offer(self):
        result = item_pricing(self.item(420), {'offer_type': 'percentage', 'pct': 20})
        assert result['final_price'] == 336
        assert result['original_price'] == 420
        assert result['discount_source'] == 'offer'

    def test_percentage_rounds_halves_up(self):
        assert item_pricing(self.item(5), {'offer_type': 'percentage', 'pct': 10})['final_price'] == 5
        assert item_pricing(self.item(15), {'offer_type': 'percentage', 'pct': 50})['final_price'] == 8

    def test_old_price_discount(self):
        result = item_pricing(self.item(300, old_price=400))
        assert result['discount_percent'] == 25
        assert result['final_price'] == 300
        assert result['original_price'] == 400
        assert result['discount_source'] == 'old_price'

    def test_old_price_not_higher_is_ignored(self):
        assert item_pricing(self.item(300, old_price=300))['discount_source'] is None
        assert item_pricing(self.item(300, old_price=200))['discount_source'] is None

    def test_offer_beats_old_price(self):
        result = item_pricing(self.item(300, old_price=400), {'offer_type': 'percentage', 'pct': 10})
        assert result['discount_source'] == 'offer'

    def test_non_percentage_offer_does_not_change_price(self):
        result = item_pricing(self.item(300), {'offer_type': 'bogo', 'pct': None})
        assert result['final_price'] == 300 and result['discount_source'] is None

    def test_item_without_price(self):
        assert item_pricing(self.item(None), {'offer_type': 'percentage', 'pct': 10})['final_price'] is None


@pytest.mark.django_db
class TestBestItemDeals:
    def make(self, restaurant, dish, title, pct, **extra):
        created = DailyDeals.objects.create(restaurant=restaurant, deal_title=title, offer_type='percentage', discount_percentage=pct, **extra)
        created.menu_items.add(dish)
        return created

    def test_picks_the_highest_percentage(self, restaurant, dish):
        self.make(restaurant, dish, 'small', 10)
        self.make(restaurant, dish, 'big', 30)
        assert best_item_deals([dish.id], timezone.localdate())[dish.id]['title'] == 'big'

    def test_ignores_expired_and_paused(self, restaurant, dish):
        self.make(restaurant, dish, 'old', 50, end_date=timezone.localdate() - timedelta(days=1))
        self.make(restaurant, dish, 'off', 50, is_active=False)
        assert best_item_deals([dish.id], timezone.localdate()) == {}

    def test_empty_input(self):
        assert best_item_deals([], timezone.localdate()) == {}


class TestIsOpenAt:
    week = {day: hour(time(9, 0), time(22, 0)) for day in range(7)}

    def test_open_during_hours(self):
        assert is_open_at(self.week, False, at(2, time(12, 0))) is True

    def test_closed_before_opening_and_at_closing_time(self):
        assert is_open_at(self.week, False, at(2, time(8, 59))) is False
        assert is_open_at(self.week, False, at(2, time(22, 0))) is False

    def test_open_exactly_at_opening_time(self):
        assert is_open_at(self.week, False, at(2, time(9, 0))) is True

    def test_temporary_closure_overrides_hours(self):
        assert is_open_at(self.week, True, at(2, time(12, 0))) is False

    def test_day_marked_closed(self):
        days = {2: hour(None, None, is_closed=True)}
        assert is_open_at(days, False, at(2, time(12, 0))) is False

    def test_hours_not_set_returns_none(self):
        assert is_open_at({}, False, at(2, time(12, 0))) is None

    def test_overnight_hours_before_midnight(self):
        days = {4: hour(time(18, 0), time(2, 0))}
        assert is_open_at(days, False, at(4, time(23, 30))) is True

    def test_overnight_hours_after_midnight_use_previous_day(self):
        days = {4: hour(time(18, 0), time(2, 0)), 5: hour(time(9, 0), time(17, 0))}
        assert is_open_at(days, False, at(5, time(1, 0))) is True
        assert is_open_at(days, False, at(5, time(3, 0))) is False

    def test_sunday_overnight_wraps_to_monday(self):
        days = {6: hour(time(18, 0), time(2, 0))}
        assert is_open_at(days, False, at(0, time(1, 0))) is True


class TestHaversine:
    def test_same_point_is_zero(self):
        assert haversine_km(23.7, 90.4, 23.7, 90.4) == pytest.approx(0)

    def test_dhaka_to_chattogram_is_about_215_km(self):
        assert haversine_km(23.8103, 90.4125, 22.3569, 91.7832) == pytest.approx(215, abs=10)

    def test_is_symmetric(self):
        assert haversine_km(23.7, 90.4, 22.3, 91.8) == pytest.approx(haversine_km(22.3, 91.8, 23.7, 90.4))

    def test_accepts_decimals_and_strings(self):
        assert haversine_km('23.7465', '90.376', 23.75, 90.38) < 1


class TestBadLanguage:
    @pytest.mark.parametrize('text', ['you are a bitch', 'This is SHIT', 'f*ck this place', 'sh1t food', 'fuuuuck', 'what the f**k', 'tui harami'])
    def test_detects_bad_words(self, text):
        assert has_bad_language(text) is True

    @pytest.mark.parametrize('text', ['Great food and friendly staff', 'Loved the classic burger', 'Class assignment', '', None])
    def test_allows_clean_text(self, text):
        assert has_bad_language(text) is False


class TestRatingKey:
    def test_whole_and_half_ratings(self):
        assert rating_key(5) == '5'
        assert rating_key(5.0) == '5'
        assert rating_key(4.5) == '4.5'


class TestPageParams:
    def test_defaults(self):
        assert page_params({}) == (1, 20)

    def test_reads_values(self):
        assert page_params({'page': '3', 'page_size': '50'}) == (3, 50)

    @pytest.mark.parametrize('query', [{'page': '0'}, {'page': 'abc'}, {'page_size': '101'}, {'page_size': '-1'}])
    def test_rejects_bad_values(self, query):
        with pytest.raises(PageError):
            page_params(query)


@pytest.mark.django_db
class TestSlug:
    def test_restaurant_gets_slug_from_name(self, restaurant):
        assert restaurant.slug == 'burger-house'

    def test_duplicate_names_get_unique_slugs(self, restaurant):
        from account.models import Restaurant
        twin = Restaurant.objects.create(name='Burger House')
        assert twin.slug != restaurant.slug

    def test_slug_follows_a_rename(self, restaurant):
        restaurant.name = 'Burger Palace'
        restaurant.save()
        assert restaurant.slug == 'burger-palace'
