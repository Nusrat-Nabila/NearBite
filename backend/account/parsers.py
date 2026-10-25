from rest_framework.exceptions import ParseError
from rest_framework.parsers import JSONParser


class SafeJSONParser(JSONParser):

    # Parse JSON and turn bad input into a clean parse error.
    def parse(self, stream, media_type=None, parser_context=None):
        try:
            return super().parse(stream, media_type, parser_context)
        except RecursionError:
            raise ParseError('The JSON is nested too deeply')


class JSONObjectParser(SafeJSONParser):

    # Parse JSON and require the body to be an object.
    def parse(self, stream, media_type=None, parser_context=None):
        data = super().parse(stream, media_type, parser_context)
        if not isinstance(data, dict):
            raise ParseError('The request body must be a JSON object, like {"name": "value"}')
        return data
