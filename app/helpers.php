<?php

if (! function_exists('debug_log')) {
    /**
     * Log a debug message to the logs.
     *
     * @param  string  $message
     * @param  array  $context
     * @return void
     */
    function debug_log($message = null, array $context = [])
    {
        if (!env('APP_DEBUG')) {
            return;
        }

        return app('log')->debug($message, $context);
    }
}
