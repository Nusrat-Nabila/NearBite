
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('account', '0003_restaurantrequest_decline_reason'),
        ('restaurant', '0004_openinghour_check_constraints'),
    ]

    operations = [
        migrations.AddConstraint(
            model_name='dailydeals',
            constraint=models.CheckConstraint(condition=models.Q(('discount_percentage__isnull', True), models.Q(('discount_percentage__gte', 1), ('discount_percentage__lte', 100)), _connector='OR'), name='dailydeal_discount_1_to_100'),
        ),
        migrations.AddConstraint(
            model_name='dailydeals',
            constraint=models.CheckConstraint(condition=models.Q(('start_date__isnull', True), ('end_date__isnull', True), ('end_date__gte', models.F('start_date')), _connector='OR'), name='dailydeal_end_not_before_start'),
        ),
        migrations.AddConstraint(
            model_name='dailydeals',
            constraint=models.CheckConstraint(condition=models.Q(models.Q(('offer_type', 'percentage'), _negated=True), ('discount_percentage__isnull', False), _connector='OR'), name='dailydeal_percentage_needs_discount'),
        ),
    ]
