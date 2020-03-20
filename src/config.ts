import { join as pathJoin } from 'path'

type Config = {
  listenPort: number
  maxQueryAmount: number
  apiCacheTtl: number
  authorization: {
    projectId: string
    privateKey: string
    clientEmail: string
  }
  analytics: {
    viewId: string
    startDate: string
    endDate: string
  }
}

function parseConfig(): Config {
  // TODO: validate
  let config = require(pathJoin(__dirname, '../config.json'))
  return config
}

export { Config, parseConfig }
