
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('account', '0003_restaurantrequest_decline_reason'),
    ]

    operations = [
        migrations.AddConstraint(
            model_name='restaurant',
            constraint=models.CheckConstraint(condition=models.Q(('latitude__isnull', True), models.Q(('latitude__gte', -90), ('latitude__lte', 90)), _connector='OR'), name='restaurant_latitude_in_range'),
        ),
        migrations.AddConstraint(
            model_name='restaurant',
            constraint=models.CheckConstraint(condition=models.Q(('longitude__isnull', True), models.Q(('longitude__gte', -180), ('longitude__lte', 180)), _connector='OR'), name='restaurant_longitude_in_range'),
        ),
        migrations.AddConstraint(
            model_name='restaurant',
            constraint=models.CheckConstraint(condition=models.Q(models.Q(('latitude__isnull', True), ('longitude__isnull', True)), models.Q(('latitude__isnull', False), ('longitude__isnull', False)), _connector='OR'), name='restaurant_coordinates_come_in_pairs'),
        ),
    ]
