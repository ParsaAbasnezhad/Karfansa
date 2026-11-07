
from django.core.management.base import BaseCommand

from apps.news.services.rss_fetcher import fetch_all_sources


class Command(BaseCommand):
    help = "Fetch and filter news from active RSS sources"

    def handle(self, *args, **options):
        self.stdout.write("Starting RSS fetching...")

        results = fetch_all_sources()

        for result in results:
            if result["status"] == "success":
                self.stdout.write(
                    self.style.SUCCESS(
                        f'{result["source"]}: '
                        f'{result["created"]} saved, '
                        f'{result["rejected"]} rejected'
                    )
                )
            else:
                self.stdout.write(
                    self.style.ERROR(
                        f'{result["source"]}: {result["error"]}'
                    )
                )

        self.stdout.write("RSS fetching completed.")
