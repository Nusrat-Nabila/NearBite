
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('account', '0003_restaurantrequest_decline_reason'),
        ('restaurant', '0003_menuitem_restaurant_optional_category'),
    ]

    operations = [
        migrations.AddConstraint(
            model_name='openinghour',
            constraint=models.CheckConstraint(condition=models.Q(('day_of_week__gte', 0), ('day_of_week__lte', 6)), name='openinghour_day_is_0_to_6'),
        ),
        migrations.AddConstraint(
            model_name='openinghour',
            constraint=models.CheckConstraint(condition=models.Q(('is_closed', True), models.Q(('open_time__isnull', False), ('close_time__isnull', False), models.Q(('open_time', models.F('close_time')), _negated=True)), _connector='OR'), name='openinghour_open_day_has_different_times'),
        ),
    ]
