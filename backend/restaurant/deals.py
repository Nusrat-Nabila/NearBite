from django.db.models import Q

STATUSES = ('active', 'scheduled', 'expired', 'paused')


# Say whether a deal is paused, scheduled, expired or active.
def deal_status(deal, today):
    if not deal.is_active:
        return 'paused'
    if deal.start_date and deal.start_date > today:
        return 'scheduled'
    if deal.end_date and deal.end_date < today:
        return 'expired'
    return 'active'


# Database filter for a deal status, using the same rules as deal_status.
def status_filter(status, today):
    if status == 'paused':
        return Q(is_active=False)
    if status == 'scheduled':
        return Q(is_active=True, start_date__gt=today)
    if status == 'expired':
        return Q(is_active=True, end_date__lt=today)
    if status == 'active':
        return Q(is_active=True) & (Q(start_date__isnull=True) | Q(start_date__lte=today)) & (Q(end_date__isnull=True) | Q(end_date__gte=today))
    raise ValueError(f"unknown status {status!r}")


# Find the best active offer for each dish.
def best_item_deals(item_ids, today):
    from .models import DailyDeals
    if not item_ids:
        return {}
    active = DailyDeals.objects.filter(status_filter('active', today)).values('id')
    rows = DailyDeals.menu_items.through.objects.filter(menuitem_id__in=item_ids, dailydeals_id__in=active).values_list(
        'menuitem_id', 'dailydeals_id', 'dailydeals__deal_title', 'dailydeals__offer_type', 'dailydeals__discount_percentage',
    )
    best = {}
    for item_id, deal_id, title, offer_type, pct in rows:
        deal = {'id': deal_id, 'title': title, 'offer_type': offer_type, 'pct': pct}
        rank = (offer_type == 'percentage', pct or 0, deal_id)
        if item_id not in best or rank > best[item_id][0]:
            best[item_id] = (rank, deal)
    return {item_id: deal for item_id, (rank, deal) in best.items()}


# Work out the original price, final price and discount of a dish.
def item_pricing(item, deal=None):
    price = item.price
    if deal and deal['offer_type'] == 'percentage' and deal['pct'] and price is not None:
        final = (price * (100 - deal['pct']) + 50) // 100
        return {'original_price': price, 'final_price': final, 'discount_percent': deal['pct'], 'discount_source': 'offer'}
    if item.old_price is not None and price is not None and item.old_price > price:
        percent = round((item.old_price - price) * 100 / item.old_price)
        return {'original_price': item.old_price, 'final_price': price, 'discount_percent': percent, 'discount_source': 'old_price'}
    return {'original_price': None, 'final_price': price, 'discount_percent': None, 'discount_source': None}
