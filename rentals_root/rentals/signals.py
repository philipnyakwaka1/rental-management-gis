from django.apps import apps
from django.contrib.auth import get_user_model
from django.db.models.signals import post_save, pre_delete, post_delete
from django.dispatch import receiver

# Use get_user_model to support custom user models
User = get_user_model()


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """
    Create a Profile for a newly created User.
    Import Profile lazily here to avoid
    potential circular import problems at module import time.
    """
    from .models import Profile

    if created:
        Profile.objects.create(user=instance)


@receiver(pre_delete, sender=apps.get_model('rentals', 'Profile'))
def save_related_buildings_before_profile_deletion(sender, instance, **kwargs):
    """
    Cache related Building IDs before the Profile is deleted.
    """
    instance._related_building_ids = list(instance.buildings.values_list('id', flat=True))


@receiver(post_delete, sender=apps.get_model('rentals', 'Profile'))
def delete_orphaned_buildings_after_profile_deletion(sender, instance, **kwargs):
    """
    After a Profile is deleted, delete any Buildings that no longer have
    related Profiles.
    """
    Building = apps.get_model('rentals', 'Building')

    for bid in getattr(instance, '_related_building_ids', []):
        building = Building.objects.filter(id=bid).first()
        if building and not building.profiles.exists():
            building.delete()
