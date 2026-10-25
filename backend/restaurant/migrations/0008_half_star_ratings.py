
import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('account', '0005_customer_area'),
        ('restaurant', '0007_dish_old_price_item_deals_dish_reviews'),
    ]

    operations = [
        migrations.AlterField(
            model_name='dishreview',
            name='rating',
            field=models.FloatField(validators=[django.core.validators.MinValueValidator(0.5), django.core.validators.MaxValueValidator(5)]),
        ),
        migrations.AlterField(
            model_name='review',
            name='rating',
            field=models.FloatField(validators=[django.core.validators.MinValueValidator(0.5), django.core.validators.MaxValueValidator(5)]),
        ),
        migrations.AddConstraint(
            model_name='dishreview',
            constraint=models.CheckConstraint(condition=models.Q(('rating__in', [5.0, 4.5, 4.0, 3.5, 3.0, 2.5, 2.0, 1.5, 1.0, 0.5])), name='dishreview_rating_is_half_star_step'),
        ),
        migrations.AddConstraint(
            model_name='review',
            constraint=models.CheckConstraint(condition=models.Q(('rating__in', [5.0, 4.5, 4.0, 3.5, 3.0, 2.5, 2.0, 1.5, 1.0, 0.5])), name='review_rating_is_half_star_step'),
        ),
    ]
