
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('account', '0005_customer_area'),
    ]

    operations = [
        migrations.AddField(
            model_name='restaurant',
            name='owner_name',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name='restaurantrequest',
            name='restaurant_owner_name',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
    ]
