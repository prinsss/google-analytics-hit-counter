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
   * @param {string[]} identifiers
   * @returns {[identifier: string]: number}
   * @memberof ApiClient
   */
  async getPageViews(identifiers: string[]) {
    const reporting = google.analyticsreporting({
      version: 'v4',
      auth: this.authClient,
    })

    // Build filter with given identifiers
    const filters = identifiers.reduce((acc, id) => acc.concat({
      'dimensionName': 'ga:pagePath',
      'operator': 'BEGINS_WITH',
      'expressions': [`/${id}`],
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

    const pvCount: {[identifier: string]: number} = {}

    // Format API response
    for (const report of response.data.reports) {
      if (!report.data.rows)
        continue;

      for (const row of report.data.rows) {
        try {
          // Strip query strings from URI and extract page identifier
          // e.g. "/example-slug/?nsukey=xxx&whatever" => "example-slug"
          const pageUri = /\/([^\/]+)\//.exec(row.dimensions[0])[1]

          const value = parseInt(row.metrics[0].values[0])
          pvCount[pageUri] = (pvCount[pageUri] || 0) + value
        } catch (err) {
          // TODO: handle accessing undefined elements
          console.log(err)
        }
      }
    }

    // Set pageview of nonexistent identifier to 0
    identifiers.forEach(id => {
      if (pvCount[id] === undefined) {
        pvCount[id] = 0
      }
    })

    debug('api')('count result: ' + JSON.stringify(pvCount))
    return pvCount
  }
}

export { ApiClient }
