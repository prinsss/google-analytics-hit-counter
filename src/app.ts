import express, { Request, Response, NextFunction } from 'express'
import cache from 'memory-cache'
import CreateHttpError, { HttpError } from 'http-errors'
import Debug from 'debug'
import { parseConfig } from './config'
import { ApiClient } from './api-client'

const app = express()
const config = parseConfig()
const apiClient = new ApiClient(config)
const debug = Debug('cache')

app.use('/api', (req, res, next) => {
  res.setHeader('Content-Type', 'application/json')
  next()
})

// Catch all promise errors
const asyncWrap = (fn: Function) => (...args: any[]) => fn(...args).catch(args[2])

app.get('/api/pageviews', asyncWrap(async (req: Request, res: Response) => {
  // Parse query string
  const query = req.query.pages as string
  let pages: string[] = query && query.split(',') || []

  // Validate queries
  if (!pages.length) {
    throw CreateHttpError(400, 'No pages specified')
  } else if (pages.length > config.maxQueryAmount) {
    throw CreateHttpError(400, 'Maximum query amount per request exceeded')
  }

  // Prepend leading slash
  pages = pages.map(uri => uri.startsWith('/') ? uri : `/${uri}`)

  let pagesNeedUpdate: string[] = []
  let data: {[uri: string]: number} = {}

  // Pull data from cache first
  for (const uri of pages) {
    if (cache.get(uri) !== null) {
      data[uri] = cache.get(uri)
      debug(`HIT: ${uri}, value: ${data[uri]}`)
    } else {
      pagesNeedUpdate.push(uri)
      debug(`MISS: ${uri}`)
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
app.use((err: HttpError, req: Request, res: Response, next: NextFunction) => {
  const status = err.status || err.statusCode || 500

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
