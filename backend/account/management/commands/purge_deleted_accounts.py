from django.core.management.base import BaseCommand

from account.status import purge_due_accounts


class Command(BaseCommand):
    help = "Permanently delete the accounts whose 30 day deletion period is over."

    # Run the purge once.
    def handle(self, *args, **options):
        purge_due_accounts()
        self.stdout.write("Done.")
