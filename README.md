# Google Analytics Hit Counter

A page views counter that pulls data from Google Analytics API.

This is a PHP implementation built with Lumen micro-framework. For Node.js version, checkout to [master](https://github.com/printempw/google-analytics-hit-counter/tree/master) branch.

## Pre-requisites

To start, you need to first enable [Google Analytics Reporting API](https://developers.google.com/analytics/devguides/reporting/core/v4), and create corresponding credentials.

Follow [this guide](https://developers.google.com/analytics/devguides/reporting/core/v4/quickstart/service-py#1_enable_the_api) to create a service account and get your keys in JSON format.

## Setup

Install project dependencies:

```sh
$ composer install
```

Copy the config file `.env.example` to `.env` and replace the values inside:

```sh
# Maximum amount of queries in a single request
MAX_QUERY_AMOUNT=10
# TTL of cache for remote API response (in seconds)
API_CACHE_TTL=3600
# Relative path to JSON key file of service account
KEY_FILE_LOCATION=credentials.json
# View ID of Analytics
VIEW_ID=REPLACE_WITH_VIEW_ID
# To count total pageviews, set an early enough value
START_DATE=2010-01-01
END_DATE=today
```

To find your Google Analytics View ID, navigate to Admin > View > View Settings.

You should always turn off debug mode in production:

```sh
APP_ENV=production
APP_DEBUG=false
```

Additionally, if you want to use Redis as cache driver:

```sh
CACHE_DRIVER=redis
REDIS_CLIENT=predis
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=secret
REDIS_PORT=6379
```

## Usage

To run a Lumen application, please check the [deployment documentation](https://laravel.com/docs/7.x/deployment).

Or just start with the built-in PHP development server:

```sh
$ php -S localhost:8000 -t public
```

Make a HTTP GET request to get pageviews (multiple URIs can be separated by commas):

```sh
$ curl -X GET -H 'Content-Type: application/json' \
  'http://localhost:8000/api/pageviews?pages=/foo-bar,/test/page'
```

```json
{
  "data": {
    "/foo-bar": 114,
    "/test/page": 514
  }
}
```

## License

MIT
