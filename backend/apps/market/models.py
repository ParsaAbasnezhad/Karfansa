from django.db import models


class MarketIndicator(models.Model):
    """A market instrument whose prices are collected over time."""

    class Category(models.TextChoices):
        EXCHANGE = "exchange", "Exchange"
        GOLD = "gold", "Gold"
        OIL = "oil", "Oil"
        STOCK = "stock", "Stock"

    category = models.CharField(max_length=20, choices=Category.choices, db_index=True)
    symbol = models.CharField(max_length=40)
    name = models.CharField(max_length=160)
    currency = models.CharField(max_length=12, default="IRR")
    unit = models.CharField(max_length=24, blank=True)
    is_featured = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-is_featured", "category", "symbol"]
        constraints = [
            models.UniqueConstraint(
                fields=["category", "symbol"], name="market_indicator_unique_symbol"
            )
        ]

    def __str__(self) -> str:
        return f"{self.symbol} ({self.get_category_display()})"


class MarketPrice(models.Model):
    """One normalized upstream price observation for a market indicator."""

    indicator = models.ForeignKey(MarketIndicator, related_name="prices", on_delete=models.CASCADE)
    value = models.DecimalField(max_digits=24, decimal_places=6)
    change_percent = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    source = models.CharField(max_length=160, blank=True)
    observed_at = models.DateTimeField()
    fetched_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-observed_at", "-pk"]
        indexes = [models.Index(fields=["indicator", "-observed_at"])]
        constraints = [
            models.UniqueConstraint(
                fields=["indicator", "observed_at"], name="market_price_unique_observation"
            )
        ]

    def __str__(self) -> str:
        return f"{self.indicator.symbol}: {self.value} at {self.observed_at}"


class MarketDataProvider(models.Model):
    """Configuration and capabilities for the upstream market data provider."""

    name = models.CharField(max_length=100, default="StreamData")
    website_url = models.URLField(default="https://streamdata.ir")
    rest_base_url = models.URLField(blank=True)
    websocket_url = models.CharField(max_length=300, blank=True)
    api_key = models.CharField(max_length=500, blank=True)
    api_key_header = models.CharField(max_length=100, default="Authorization")
    api_key_prefix = models.CharField(max_length=50, default="Bearer")
    rest_requests_per_minute = models.PositiveSmallIntegerField(default=60)
    websocket_connections = models.PositiveSmallIntegerField(default=5)
    subscription_pricing = models.CharField(max_length=300, blank=True)
    coverage = models.JSONField(default=list)
    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Market data provider"
        verbose_name_plural = "Market data providers"

    def __str__(self) -> str:
        return self.name
