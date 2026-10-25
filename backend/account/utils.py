from django.utils.text import slugify


# Create a unique slug for a model instance from a name.
def generate_unique_slug(instance, value):
    base_slug = slugify(value)
    slug = base_slug
    model_class = instance.__class__
    counter = 1
    while model_class.objects.filter(slug=slug).exclude(pk=instance.pk).exists():
        slug = f"{base_slug}-{counter}"
        counter += 1
    return slug
