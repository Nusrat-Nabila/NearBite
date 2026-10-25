
import django.core.validators
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('account', '0004_restaurant_coordinate_checks'),
        ('restaurant', '0006_meal_types_and_occasions'),
    ]

    operations = [
        migrations.AddField(
            model_name='dailydeals',
            name='menu_items',
            field=models.ManyToManyField(blank=True, related_name='deals', to='restaurant.menuitem'),
        ),
        migrations.AddField(
            model_name='menuitem',
            name='old_price',
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.CreateModel(
            name='DishReview',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('rating', models.PositiveSmallIntegerField(validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(5)])),
                ('comment', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('customer', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='dish_reviews', to='account.customer')),
                ('menu_item', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='reviews', to='restaurant.menuitem')),
            ],
            options={
                'unique_together': {('customer', 'menu_item')},
            },
        ),
    ]
