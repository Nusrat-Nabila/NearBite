import statistics
from urllib.parse import quote

PRICE_LEVEL_BREAKS = (250, 500)
PRICE_LEVELS = {1: ('৳', 'Budget'), 2: ('৳৳', 'Moderate'), 3: ('৳৳৳', 'Premium')}


# Work out the price range shown on the restaurant page.
def price_info(restaurant, sale_prices):
    low = restaurant.min_price if restaurant.min_price is not None else (min(sale_prices) if sale_prices else None)
    high = restaurant.max_price if restaurant.max_price is not None else (max(sale_prices) if sale_prices else None)

    if sale_prices:
        typical = statistics.median(sale_prices)
    elif low is not None and high is not None:
        typical = (low + high) / 2
    else:
        typical = low if low is not None else high

    if typical is None:
        return {'min': low, 'max': high, 'typical': None, 'level': None, 'symbol': None, 'label': None}
    level = 1 if typical <= PRICE_LEVEL_BREAKS[0] else 2 if typical <= PRICE_LEVEL_BREAKS[1] else 3
    symbol, label = PRICE_LEVELS[level]
    return {'min': low, 'max': high, 'typical': round(typical), 'level': level, 'symbol': symbol, 'label': label}


# Build the address parts and the full address text.
def address_info(restaurant):
    parts = [part for part in (restaurant.location, restaurant.area, restaurant.city) if part]
    return {'location': restaurant.location, 'area': restaurant.area, 'city': restaurant.city, 'full': ', '.join(parts) or None}


# Build the map position and OpenStreetMap links, or None without a position.
def map_info(restaurant):
    if restaurant.latitude is None or restaurant.longitude is None:
        return None
    lat, lng = float(restaurant.latitude), float(restaurant.longitude)
    pad = 0.004
    bbox = f"{lng - pad:.6f},{lat - pad:.6f},{lng + pad:.6f},{lat + pad:.6f}"
    return {
        'latitude': lat,
        'longitude': lng,
        'openstreetmap_url': f"https://www.openstreetmap.org/?mlat={lat:.6f}&mlon={lng:.6f}#map=17/{lat:.6f}/{lng:.6f}",
        'directions_url': f"https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=%3B{lat:.6f}%2C{lng:.6f}",
        'embed_url': f"https://www.openstreetmap.org/export/embed.html?bbox={quote(bbox, safe='')}&layer=mapnik&marker={lat:.6f}%2C{lng:.6f}",
    }


MAX_DISH_PHOTOS = 6


# Collect the cover photo, logo and up to 6 dish photos.
def photos_info(restaurant, dishes, request):
    # Turn a file into a full URL.
    def url(image):
        return request.build_absolute_uri(image.url) if request else image.url

    photos = []
    if restaurant.cover_image:
        photos.append({'type': 'cover', 'url': url(restaurant.cover_image), 'caption': restaurant.name})
    if restaurant.logo:
        photos.append({'type': 'logo', 'url': url(restaurant.logo), 'caption': restaurant.name})
    shown = 0
    for dish in dishes:
        if dish.image and shown < MAX_DISH_PHOTOS:
            photos.append({'type': 'dish', 'url': url(dish.image), 'caption': dish.name})
            shown += 1
    return photos


AVAILABILITY_CHOICES = ('all', 'available', 'out_of_stock')
MAX_ID = 9_223_372_036_854_775_807


class MenuFilterError(Exception):
    pass


# Read a price filter from the query string.
def _price(query, name):
    if name not in query:
        return None
    raw = (query.get(name) or '').strip()
    if not raw.isdigit() or int(raw) > 10_000_000:
        raise MenuFilterError(f"{name} must be a whole number of taka, 0 or more")
    return int(raw)


# Read and check the menu filters from the query string.
def parse_menu_filters(query):
    filters = {'category_ids': [], 'uncategorized': False, 'dietary': []}

    for raw in query.getlist('category'):
        for piece in raw.split(','):
            piece = piece.strip().lower()
            if not piece:
                continue
            if piece == 'none':
                filters['uncategorized'] = True
            elif piece.isdigit() and int(piece) <= MAX_ID:
                if int(piece) not in filters['category_ids']:
                    filters['category_ids'].append(int(piece))
            else:
                raise MenuFilterError(f"category must be category ids or 'none', not '{piece}'")

    for raw in query.getlist('dietary'):
        for piece in raw.split(','):
            piece = piece.strip().lower()
            if piece and piece not in filters['dietary']:
                filters['dietary'].append(piece)

    filters['min_price'] = _price(query, 'min_price')
    filters['max_price'] = _price(query, 'max_price')
    if filters['min_price'] is not None and filters['max_price'] is not None and filters['min_price'] > filters['max_price']:
        raise MenuFilterError("min_price cannot be more than max_price")

    availability = (query.get('availability') or 'all').strip().lower()
    if availability not in AVAILABILITY_CHOICES:
        raise MenuFilterError(f"availability must be one of: {', '.join(AVAILABILITY_CHOICES)}")
    filters['availability'] = availability
    return filters
