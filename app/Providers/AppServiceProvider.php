<?php

namespace App\Providers;

use Google_Client;
use Illuminate\Support\ServiceProvider;
use Google_Service_AnalyticsReporting;
use Symfony\Component\Cache\Adapter\Psr16Adapter;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     *
     * @return void
     */
    public function register()
    {
        $this->app->singleton(Google_Service_AnalyticsReporting::class, function () {
            // Create and configure a new client object
            $client = new Google_Client();
            debug_log("==============================");
            debug_log("Initializing Google API Client...");

            // Set proxy (if necessary)
            if ($proxy = env('HTTP_PROXY')) {
                $client->setHttpClient(new \GuzzleHttp\Client([
                    'proxy' => $proxy,
                    'verify' => false,
                ]));
                debug_log("Proxy enabled: $proxy");
            }

            // Set our logger and cache driver for the client
            $client->setLogger(app('log'));
            // Using Lumen's PSR-16 cache as PSR-6 cache interface via adapter
            $client->setCache(new Psr16Adapter(app('cache.store')));

            $client->setApplicationName('google-analytics-hit-counter');
            $client->setAuthConfig(base_path(env('KEY_FILE_LOCATION')));
            $client->setScopes(['https://www.googleapis.com/auth/analytics.readonly']);

            debug_log("Google API Client initialized", [$client]);
            return new Google_Service_AnalyticsReporting($client);
        });
    }
}
