import django.db.models.deletion
from django.db import migrations, models


# Copy each dish's restaurant from its category.
def fill_restaurant_from_category(apps, schema_editor):
    MenuItem = apps.get_model('restaurant', 'MenuItem')
    for item in MenuItem.objects.select_related('category').all():
        item.restaurant_id = item.category.restaurant_id
        item.save(update_fields=['restaurant'])


class Migration(migrations.Migration):

    dependencies = [
        ('account', '0003_restaurantrequest_decline_reason'),
        ('restaurant', '0002_dietarytag_cuisine_unique_name'),
    ]

    operations = [
        migrations.AddField(
            model_name='menuitem',
            name='restaurant',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='menu_items', to='account.restaurant'),
        ),
        migrations.RunPython(fill_restaurant_from_category, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='menuitem',
            name='restaurant',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='menu_items', to='account.restaurant'),
        ),
        migrations.AlterField(
            model_name='menuitem',
            name='category',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='items', to='restaurant.menucategory'),
        ),
    ]
