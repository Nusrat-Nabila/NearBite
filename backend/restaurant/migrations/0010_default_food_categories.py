from django.db import migrations
from django.utils.text import slugify

DEFAULT_CATEGORIES = [
    ('Pizza', ['pizza']),
    ('Burger', ['burger']),
    ('Biryani', ['biryani', 'tehari', 'polao']),
    ('Steak', ['steak', 'sizzling']),
    ('Shawarma', ['shawarma']),
    ('Fried Chicken', ['fried chicken', 'wings', 'strips', 'zinger']),
    ('Noodles', ['noodle', 'chow mein']),
    ('Pasta', ['pasta', 'alfredo', 'arrabbiata']),
    ('Sandwich', ['sandwich', 'wrap']),
    ('Soup', ['soup']),
    ('Rice', ['fried rice', 'polao', 'tehari']),
    ('Drinks', ['shake', 'lemonade', 'juice', 'cola']),
    ('Coffee', ['coffee', 'latte', 'cappuccino', 'cold brew']),
    ('Dessert', ['cake', 'cupcake', 'cookie', 'tiramisu', 'firni', 'slice']),
    ('Bakery', ['croissant', 'sourdough', 'bread']),
    ('Sides', ['fries', 'onion rings', 'coleslaw', 'mashed']),
]


# Add the default food categories.
def add_default_categories(apps, schema_editor):
    FoodCategory = apps.get_model('restaurant', 'FoodCategory')
    MenuItem = apps.get_model('restaurant', 'MenuItem')

    for name, words in DEFAULT_CATEGORIES:
        category, _ = FoodCategory.objects.get_or_create(
            name=name, defaults={'slug': slugify(name)},
        )
        for dish in MenuItem.objects.all():
            if any(word in dish.name.lower() for word in words):
                dish.food_categories.add(category)


class Migration(migrations.Migration):

    dependencies = [
        ('restaurant', '0009_food_categories'),
    ]

    operations = [
        migrations.RunPython(add_default_categories, migrations.RunPython.noop),
    ]
