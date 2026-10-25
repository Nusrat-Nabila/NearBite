
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('account', '0004_restaurant_coordinate_checks'),
    ]

    operations = [
        migrations.AddField(
            model_name='customer',
            name='customer_area',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
    ]
