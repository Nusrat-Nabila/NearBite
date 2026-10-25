
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('account', '0004_restaurant_coordinate_checks'),
        ('restaurant', '0005_dailydeals_check_constraints'),
    ]

    operations = [
        migrations.CreateModel(
            name='RestaurantMealType',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('meal_type', models.CharField(choices=[('breakfast', 'Breakfast'), ('lunch', 'Lunch'), ('snacks', 'Snacks'), ('dinner', 'Dinner')], max_length=20)),
                ('restaurant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='meal_types', to='account.restaurant')),
            ],
            options={
                'ordering': ['id'],
                'constraints': [models.UniqueConstraint(fields=('restaurant', 'meal_type'), name='unique_restaurant_meal_type'), models.CheckConstraint(condition=models.Q(('meal_type__in', ['breakfast', 'lunch', 'snacks', 'dinner'])), name='restaurant_meal_type_is_valid')],
            },
        ),
        migrations.CreateModel(
            name='RestaurantOccasion',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('occasion', models.CharField(choices=[('family', 'Family'), ('couples', 'Couples'), ('friends', 'Friends / Large Groups'), ('solo', 'Solo')], max_length=20)),
                ('restaurant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='dining_occasions', to='account.restaurant')),
            ],
            options={
                'ordering': ['id'],
                'constraints': [models.UniqueConstraint(fields=('restaurant', 'occasion'), name='unique_restaurant_occasion'), models.CheckConstraint(condition=models.Q(('occasion__in', ['family', 'couples', 'friends', 'solo'])), name='restaurant_occasion_is_valid')],
            },
        ),
    ]
