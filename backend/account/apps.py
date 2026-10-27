import logging
import os
import sys
import threading

from django.apps import AppConfig

logger = logging.getLogger(__name__)

PURGE_EVERY_SECONDS = 60 * 60


# Tell whether this process is a web server that should run the nightly clean-up.
def should_run_purge_job():
    if os.environ.get('DISABLE_AUTO_PURGE') == '1' or 'pytest' in sys.modules:
        return False
    if any(os.path.basename(arg) == 'manage.py' for arg in sys.argv[:1]):
        command = sys.argv[1] if len(sys.argv) > 1 else ''
        if command != 'runserver':
            return False
        # runserver starts a second process that does the real work; skip the watcher
        return os.environ.get('RUN_MAIN') == 'true' or '--noreload' in sys.argv
    return True


# Delete the accounts whose 30 day deletion period is over, then wait and do it again.
def run_purge_loop(stop):
    from django.db import connections

    from .status import purge_due_accounts

    while not stop.is_set():
        try:
            purge_due_accounts()
        except Exception:
            logger.exception("Could not delete the accounts that are due")
        finally:
            connections.close_all()
        stop.wait(PURGE_EVERY_SECONDS)


class AccountConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'account'

    # Start the hourly clean-up of accounts that were scheduled for deletion.
    def ready(self):
        if should_run_purge_job():
            threading.Thread(target=run_purge_loop, args=(threading.Event(),), daemon=True, name='purge-deleted-accounts').start()
