import { google } from 'googleapis'
import { GoogleAuth, OAuth2Client } from 'google-auth-library'
import { Config } from './config'
import * as debug from 'debug'

class ApiClient {
  protected auth: GoogleAuth
  protected authClient: OAuth2Client
  protected config: Config

  /**
   * Create client for Google Analytics Reporting API.
   *
   * @param {Config} config
   * @memberof ApiClient
   */
  constructor(config: Config) {
    this.config = config
    debug('api')('config: ' + JSON.stringify(config))
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
    this.authClient = await this.auth.getClient()
  }

  /**
   * Get pageview count of given pages.
   *
   * @param {string[]} pages
   * @returns {[uri: string]: number}
   * @memberof ApiClient
   */
  async getPageViews(pages: string[]) {
    const reporting = google.analyticsreporting({
      version: 'v4',
      auth: this.authClient,
    })

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

    debug('api')('request: ' + JSON.stringify(requestBody))
    const response = await reporting.reports.batchGet({ requestBody })
    debug('api')('response: ' + JSON.stringify(response))

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

    debug('api')('count result: ' + JSON.stringify(pvCount))
    return pvCount
  }
}

export { ApiClient }
