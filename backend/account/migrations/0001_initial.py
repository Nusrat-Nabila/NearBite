
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Admin',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('admin_name', models.CharField(blank=True, max_length=100, null=True)),
                ('admin_email', models.EmailField(blank=True, max_length=100, null=True, unique=True)),
                ('admin_role', models.CharField(default='admin', max_length=20)),
            ],
        ),
        migrations.CreateModel(
            name='Customer',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('customer_name', models.CharField(max_length=100)),
                ('customer_email', models.EmailField(blank=True, max_length=100, null=True, unique=True)),
                ('customer_phone', models.CharField(blank=True, max_length=15, null=True)),
                ('customer_city', models.CharField(blank=True, max_length=100, null=True)),
                ('customer_address', models.CharField(blank=True, max_length=200, null=True)),
                ('customer_image', models.ImageField(blank=True, null=True, upload_to='image/')),
                ('customer_role', models.CharField(default='customer', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name='Restaurant',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200)),
                ('description', models.TextField(blank=True, null=True)),
                ('min_price', models.IntegerField(blank=True, null=True)),
                ('max_price', models.IntegerField(blank=True, null=True)),
                ('city', models.CharField(blank=True, max_length=100, null=True)),
                ('area', models.CharField(blank=True, max_length=100, null=True)),
                ('location', models.CharField(blank=True, max_length=200, null=True)),
                ('latitude', models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ('longitude', models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ('email', models.EmailField(blank=True, max_length=100, null=True, unique=True)),
                ('phone_no', models.CharField(blank=True, max_length=20, null=True)),
                ('business_reg_id', models.CharField(blank=True, max_length=50, null=True)),
                ('logo', models.ImageField(blank=True, null=True, upload_to='image/')),
                ('cover_image', models.ImageField(blank=True, null=True, upload_to='image/')),
                ('is_temporarily_closed', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('slug', models.SlugField(blank=True, null=True, unique=True)),
            ],
        ),
        migrations.CreateModel(
            name='RestaurantRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('restaurant_name', models.CharField(max_length=200)),
                ('restaurant_email', models.EmailField(blank=True, max_length=100, null=True, unique=True)),
                ('restaurant_phone', models.CharField(blank=True, max_length=20, null=True)),
                ('restaurant_business_reg_id', models.CharField(blank=True, max_length=50, null=True)),
                ('restaurant_city', models.CharField(blank=True, max_length=100, null=True)),
                ('restaurant_area', models.CharField(blank=True, max_length=100, null=True)),
                ('restaurant_location', models.CharField(blank=True, max_length=200, null=True)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('approved', 'Approved'), ('declined', 'Declined')], default='pending', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name='UserAuth',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('user_name', models.CharField(blank=True, max_length=100, null=True)),
                ('user_email', models.EmailField(blank=True, max_length=100, null=True)),
                ('user_password', models.CharField(blank=True, max_length=200, null=True)),
                ('user_role', models.CharField(blank=True, max_length=20, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'unique_together': {('user_email', 'user_role')},
            },
        ),
    ]
