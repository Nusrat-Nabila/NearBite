
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('account', '0002_admin_admin_password_customer_customer_password_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='restaurantrequest',
            name='decline_reason',
            field=models.TextField(blank=True, null=True),
        ),
    ]
