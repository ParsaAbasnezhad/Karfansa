# Market data integration

Celery refreshes configured exchange, gold, oil, and stock feeds every minute. Valid observations are normalized into `MarketIndicator` and `MarketPrice`; the homepage reads featured instruments, and the markets page exposes latest prices and historical charts.

Configure StreamData in Django Admin or set `MARKET_API_KEY`, `MARKET_API_KEY_HEADER`, `MARKET_API_KEY_PREFIX`, and the feed URLs `MARKET_EXCHANGE_URL`, `MARKET_GOLD_URL`, `MARKET_OIL_URL`, and `MARKET_STOCK_URL` in `.env`. Explicit feed URLs take precedence over the provider base URL. Without explicit URLs, the adapter uses `/exchange`, `/gold`, `/oil`, and `/stocks` under the configured base URL. Replace these defaults with the paths and authentication method in the StreamData account's API documentation.

Each response must be a list of records or an object containing a `data` list. A record must contain `symbol` (or `code`) and `value` (or `price`); `name`, `currency`, `unit`, `change_percent`, and `observed_at` (or `timestamp`) are optional. If the provider omits `change_percent`, the backend derives it from the previous observation.

Use the Django Admin `is_featured` field to choose which instrument represents each category on the homepage. The API endpoints are:

- `GET /api/v1/market/overview/` — latest prices and recent points for charts.
- `GET /api/v1/market/quotes/?category=gold` — latest prices filtered by category.
- `GET /api/v1/market/history/?category=gold&symbol=GOLD18&limit=100` — chronological chart data (maximum 500 points).
