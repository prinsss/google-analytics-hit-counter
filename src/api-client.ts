import { google, Auth } from 'googleapis'
import { Config } from './config'
import Debug from 'debug'

const debug = Debug('api')

class ApiClient {
  protected auth: Auth.GoogleAuth
  protected config: Config

  /**
   * Create client for Google Analytics Reporting API.
   *
   * @param {Config} config
   * @memberof ApiClient
   */
  constructor(config: Config) {
    this.config = config
    debug('config: ' + JSON.stringify(config))
  }

  /**
   * Initialize Google Auth Client (via service account).
   *
   * @memberof ApiClient
   */
  async init() {
    this.auth = new google.auth.GoogleAuth({
      credentials: {
        private_key: this.config.authorization.privateKey,
        client_email: this.config.authorization.clientEmail,
      },
      projectId: this.config.authorization.projectId,
      scopes: 'https://www.googleapis.com/auth/analytics.readonly',
    })
    const authClient = await this.auth.getClient()
    google.options({ auth: authClient })
  }

  /**
   * Get pageview count of given pages.
   *
   * @param {string[]} pages
   * @returns {[uri: string]: number}
   * @memberof ApiClient
   */
  async getPageViews(pages: string[]) {
    const reporting = google.analyticsreporting('v4');

    // Build filter with given URIs
    const filters = pages.reduce((acc, id) => acc.concat({
      'dimensionName': 'ga:pagePath',
      'operator': 'BEGINS_WITH',
      'expressions': [id],
    }), [])

    // Build API request body
    const requestBody = {
      reportRequests: [{
        viewId: this.config.analytics.viewId,
        dateRanges: [{
          startDate: this.config.analytics.startDate,
          endDate: this.config.analytics.endDate,
        }],
        metrics: [{ expression: 'ga:pageviews' }],
        dimensions: [{ name: 'ga:pagePath' }],
        dimensionFilterClauses: [{ filters: filters }],
        orderBys: [{ fieldName: 'ga:pageviews', sortOrder: 'DESCENDING' }],
      }]
    }

    debug('request: ' + JSON.stringify(requestBody))
    const response = await reporting.reports.batchGet({ requestBody }, {})
    debug('response: ' + JSON.stringify(response))

    const pvCount: {[uri: string]: number} = {}

    // Format API response
    for (const report of response.data.reports) {
      if (!report.data.rows)
        continue

      for (const row of report.data.rows) {
        try {
          const pagePath = row.dimensions[0]

          for (const uri of pages) {
            if (pagePath.startsWith(uri)) {
              const value = parseInt(row.metrics[0].values[0])
              pvCount[uri] = (pvCount[uri] || 0) + value
            }
          }
        } catch (err) {
          // TODO: handle accessing undefined elements
          console.log(err)
        }
      }
    }

    // Set pageview of nonexistent URI to 0
    pages.forEach(uri => {
      if (pvCount[uri] === undefined) {
        pvCount[uri] = 0
      }
    })

    debug('count result: ' + JSON.stringify(pvCount))
    return pvCount
  }
}

export { ApiClient }
