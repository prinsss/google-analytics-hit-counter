<?php

namespace App\Controllers;

use Illuminate\Support\Str;
use Illuminate\Http\Request;
use Laravel\Lumen\Routing\Controller;
use Google_Service_AnalyticsReporting as AnalyticsReporting;
use Google_Service_AnalyticsReporting_DateRange as DateRange;
use Google_Service_AnalyticsReporting_Metric as Metric;
use Google_Service_AnalyticsReporting_ReportRequest as ReportRequest;
use Google_Service_AnalyticsReporting_GetReportsRequest as GetReportsRequest;
use Google_Service_AnalyticsReporting_Dimension as Dimension;
use Google_Service_AnalyticsReporting_DimensionFilter as DimensionFilter;
use Google_Service_AnalyticsReporting_DimensionFilterClause as DimensionFilterClause;
use Google_Service_AnalyticsReporting_OrderBy as OrderBy;

class ApiController extends Controller
{
    /**
     * Handle pageviews API request.
     *
     * @param Request $request
     * @param AnalyticsReporting $analytics
     * @return \Illuminate\Http\JsonResponse
     */
    public function getPageViews(Request $request, AnalyticsReporting $analytics)
    {
        // Parse query string
        $pages = explode(',', $request->get('pages')) ?: [];

        // Validate queries
        if (count($pages) == 0) {
            return response()->json(['error' => 'No pages specified'], 400);
        } else if (count($pages) > env('MAX_QUERY_AMOUNT')) {
            return response()->json(['error' => 'Maximum query amount per request exceeded'], 400);
        }

        // Prepend leading slash
        $pages = array_map(function ($uri) {
            return Str::startsWith($uri, '/') ? $uri : "/$uri";
        }, $pages);

        app('log')->info('Request', [$pages]);
        $pagesNeedUpdate = [];
        $data = [];

        // Pull data from cache first
        foreach ($pages as $uri) {
            if (app('cache')->get($uri) !== null) {
                $data[$uri] = intval(app('cache')->get($uri));
                debug_log("HIT: $uri, value: $data[$uri]");
            } else {
                $pagesNeedUpdate[] = $uri;
                debug_log("MISS: $uri");
            }
        }

        if (count($pagesNeedUpdate) > 0) {
            // Query Google Analytics API
            $updated = $this->queryGooglePageViewsApi($pagesNeedUpdate);

            // Save to cache
            foreach ($updated as $uri => $pv) {
                app('cache')->put([$uri => $pv], env('API_CACHE_TTL'));
                $data[$uri] = $updated[$uri];
            }
        }

        app('log')->info('Response', [$data]);
        return response()->json(['data' => $data]);
    }

    /**
     * Get pageview count of given pages.
     *
     * @param array $pages identifiers
     * @return array
     */
    protected function queryGooglePageViewsApi(array $pages)
    {
        // Get instance from Lumen Service Container
        $analytics = app(AnalyticsReporting::class);

        // God damn it. I hate these setters.
        $dateRange = new DateRange();
        $dateRange->setStartDate(env('START_DATE'));
        $dateRange->setEndDate(env('END_DATE'));

        $metric = new Metric();
        $metric->setExpression('ga:pageviews');

        $dimension = new Dimension();
        $dimension->setName('ga:pagePath');

        // Build filters with given page IDs
        $dimensionFilters = [];
        foreach ($pages as $uri) {
            $filter = new DimensionFilter();
            $filter->setDimensionName('ga:pagePath');
            $filter->setOperator('BEGINS_WITH');
            $filter->setExpressions([$uri]);

            $dimensionFilters[] = $filter;
        }

        $dimensionFilterClause = new dimensionFilterClause();
        $dimensionFilterClause->setFilters($dimensionFilters);

        $orderBy = new OrderBy();
        $orderBy->setFieldName('ga:pageviews');
        $orderBy->setSortOrder('DESCENDING');

        $request = new ReportRequest();
        $request->setViewId(env('VIEW_ID'));
        $request->setDateRanges($dateRange);
        $request->setMetrics([$metric]);
        $request->setDimensions([$dimension]);
        $request->setDimensionFilterClauses([$dimensionFilterClause]);
        $request->setOrderBys([$orderBy]);

        // Build API request body and query API
        $body = new GetReportsRequest();
        $body->setReportRequests([$request]);

        debug_log('==> API request:', [$body]);
        $response = $analytics->reports->batchGet($body);
        debug_log('<== API response:', [$response]);

        $pvCount = [];

        // Format API response
        foreach (data_get($response, '0.data.rows', []) as $row) {
            $pagePath = data_get($row, 'dimensions.0');

            foreach ($pages as $uri) {
                if (Str::startsWith($pagePath, $uri)) {
                    $value = intval(data_get($row, 'metrics.0.values.0', 0));
                    $pvCount[$uri] = data_get($pvCount, $uri, 0) + $value;
                }
            }
        }

        // Set pageview of nonexistent identifier to 0
        foreach ($pages as $id) {
            if (!isset($pvCount[$id])) {
                $pvCount[$id] = 0;
            }
        }

        return $pvCount;
    }
}
