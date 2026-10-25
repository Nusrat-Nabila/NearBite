import hashlib
import json
import math
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings
from django.core.cache import cache

EARTH_RADIUS_KM = 6371.0088
FOUND_CACHE_SECONDS = 24 * 60 * 60
NOT_FOUND_CACHE_SECONDS = 60 * 60
REQUEST_TIMEOUT_SECONDS = 5
MIN_SECONDS_BETWEEN_REQUESTS = 1.1
LOOKUPS_PER_MINUTE = 30


class GeocodingError(Exception):
    pass


class PlaceNotFound(GeocodingError):
    pass


# Straight-line distance between two points in kilometres.
def haversine_km(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(math.radians, (float(lat1), float(lon1), float(lat2), float(lon2)))
    a = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(min(1.0, math.sqrt(a)))


# Count a place search for this visitor and refuse once they pass the per-minute limit.
def allow_lookup(visitor):
    key = f"osm-quota:{visitor}:{int(time.time() // 60)}"
    cache.add(key, 0, timeout=120)
    return cache.incr(key) <= LOOKUPS_PER_MINUTE


_request_lock = threading.Lock()
_last_request_at = 0.0


# Leave at least a second between requests to OpenStreetMap.
def _wait_for_turn():
    global _last_request_at
    wait = MIN_SECONDS_BETWEEN_REQUESTS - (time.monotonic() - _last_request_at)
    if wait > 0:
        time.sleep(wait)
    _last_request_at = time.monotonic()


# Send one search request to Nominatim and return its first result.
def _ask_nominatim(query):
    params = {'q': query, 'format': 'jsonv2', 'limit': 1}
    if settings.NOMINATIM_COUNTRY_CODES:
        params['countrycodes'] = settings.NOMINATIM_COUNTRY_CODES
    if settings.NOMINATIM_LANGUAGE:
        params['accept-language'] = settings.NOMINATIM_LANGUAGE
    url = f"{settings.NOMINATIM_URL}?{urllib.parse.urlencode(params)}"
    request = urllib.request.Request(url, headers={'User-Agent': settings.NOMINATIM_USER_AGENT, 'Accept': 'application/json'})
    with _request_lock:
        _wait_for_turn()
        try:
            with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
                return json.loads(response.read().decode('utf-8'))
        except (urllib.error.URLError, TimeoutError, OSError, ValueError) as error:
            raise GeocodingError(f"The map service could not be reached: {error}") from error


# Find a place by name or address and return its coordinates.
def geocode(query):
    query = ' '.join(str(query).split())
    if len(query) < 2:
        raise PlaceNotFound("Type the name of a place")

    key = 'osm-geocode:' + hashlib.sha1(f"{settings.NOMINATIM_COUNTRY_CODES}|{settings.NOMINATIM_LANGUAGE}|{query.lower()}".encode('utf-8')).hexdigest()
    cached = cache.get(key)
    if cached is not None:
        if cached == 'not-found':
            raise PlaceNotFound(f"No place found for '{query}'")
        return cached

    answer = _ask_nominatim(query)
    try:
        best = answer[0]
        result = (round(float(best['lat']), 6), round(float(best['lon']), 6), str(best.get('display_name', query)))
    except (IndexError, KeyError, TypeError, ValueError):
        if isinstance(answer, list) and not answer:
            cache.set(key, 'not-found', NOT_FOUND_CACHE_SECONDS)
            raise PlaceNotFound(f"No place found for '{query}'")
        raise GeocodingError("The map service gave an answer we could not read")
    cache.set(key, result, FOUND_CACHE_SECONDS)
    return result


_NOT_FOUND, _TOO_MANY, _BAD_GATEWAY = 404, 429, 502


# Look a place up for a visitor, applying their rate limit.
def find_place_or_error(visitor, text):
    if not allow_lookup(visitor):
        return None, ("Too many place searches. Wait a minute and try again.", _TOO_MANY)
    try:
        return geocode(text), None
    except PlaceNotFound as error:
        return None, (str(error), _NOT_FOUND)
    except GeocodingError:
        return None, ("The map service is not available right now. Try again in a moment, or send lat and lng instead.", _BAD_GATEWAY)
