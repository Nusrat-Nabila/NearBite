from django.db import migrations
from django.utils.text import slugify

MORE_CATEGORIES = [
    ('Curry', ['bhuna', 'curry', 'dal fry', 'kung pao']),
    ('Seafood', ['ilish', 'fish', 'prawn', 'shrimp']),
    ('Appetizer', ['wonton', 'hummus', 'falafel', 'rings']),
    ('Platter', ['platter', 'plate']),
]


# Add the extra food categories.
def add_more_categories(apps, schema_editor):
    FoodCategory = apps.get_model('restaurant', 'FoodCategory')
    MenuItem = apps.get_model('restaurant', 'MenuItem')

    for name, words in MORE_CATEGORIES:
        category, _ = FoodCategory.objects.get_or_create(
            name=name, defaults={'slug': slugify(name)},
        )
        for dish in MenuItem.objects.all():
            if any(word in dish.name.lower() for word in words):
                dish.food_categories.add(category)


class Migration(migrations.Migration):

    dependencies = [
        ('restaurant', '0010_default_food_categories'),
    ]

    operations = [
        migrations.RunPython(add_more_categories, migrations.RunPython.noop),
    ]
