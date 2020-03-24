import * as express from 'express'
import * as cache from 'memory-cache'
import * as error from 'http-errors';
import * as debug from 'debug'
import { parseConfig } from './config'
import { ApiClient } from './api-client'

const app = express()
const config = parseConfig()
const apiClient = new ApiClient(config)

app.use('/api', (req, res, next) => {
  res.setHeader('Content-Type', 'application/json')
  next()
})

// Catch all promise errors
const asyncWrap = fn => (...args) => fn(...args).catch(args[2])

app.get('/api/pageviews', asyncWrap(async (req, res) => {
  // Parse query string
  let pages: string[] = req.query.pages && req.query.pages.split(',') || []

  // Validate queries
  if (!pages.length) {
    throw error(400, 'No pages specified')
  } else if (pages.length > config.maxQueryAmount) {
    throw error(400, 'Maximum query amount per request exceeded')
  }

  // Prepend leading slash
  pages = pages.map(uri => uri.startsWith('/') ? uri : `/${uri}`)

  let pagesNeedUpdate: string[] = [];
  let data: {[uri: string]: number} = {}

  // Pull data from cache first
  for (const uri of pages) {
    if (cache.get(uri) !== null) {
      data[uri] = cache.get(uri)
      debug('cache')(`HIT: ${uri}, value: ${data[uri]}`)
    } else {
      pagesNeedUpdate.push(uri)
      debug('cache')(`MISS: ${uri}`)
    }
  }

  if (pagesNeedUpdate.length > 0) {
    // Query Google Analytics API
    const updated = await apiClient.getPageViews(pagesNeedUpdate)

    // Save to cache
    for (const id in updated) {
      cache.put(id, updated[id], config.apiCacheTtl * 1000)
      data[id] = updated[id]
    }
  }

  res.status(200).json({ data })
}))

// Default error handler
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;

  // Internal server error
  if (status >= 500) {
    console.error(err.stack)
  }

  res.status(status).json({ error: err.message })
})

// Start server
app.listen(config.listenPort, async () => {
  await apiClient.init()
  console.log(`Server listening on port ${config.listenPort}`)
})
