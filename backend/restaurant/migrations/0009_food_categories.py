
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('restaurant', '0008_half_star_ratings'),
    ]

    operations = [
        migrations.CreateModel(
            name='FoodCategory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200, unique=True)),
                ('slug', models.SlugField(blank=True, null=True, unique=True)),
            ],
            options={
                'verbose_name_plural': 'food categories',
            },
        ),
        migrations.AddField(
            model_name='menuitem',
            name='food_categories',
            field=models.ManyToManyField(blank=True, related_name='menu_items', to='restaurant.foodcategory'),
        ),
    ]
