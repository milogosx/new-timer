import { getRuntimeEnvironment } from './runtimeConfig.js'

const DEFAULT_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0'
const DEFAULT_BUILD_TIME = typeof __APP_BUILD_TIME__ === 'string' ? __APP_BUILD_TIME__ : ''
const DEFAULT_GIT_SHA = typeof __APP_GIT_SHA__ === 'string' ? __APP_GIT_SHA__ : 'unknown'

let hasLoggedBuildInfo = false

function resolveBundlePath({ document = globalThis.document } = {}) {
  const moduleScript = document?.querySelector?.('script[type="module"][src]')
  const scriptSource = moduleScript?.getAttribute?.('src') || moduleScript?.src

  if (typeof scriptSource === 'string' && scriptSource.length > 0) {
    try {
      const baseUrl = document?.baseURI || globalThis.location?.href || 'http://localhost'
      return new URL(scriptSource, baseUrl).pathname
    } catch {
      return scriptSource
    }
  }

  try {
    return new URL(import.meta.url).pathname
  } catch {
    return ''
  }
}

function resolveBundleId(bundlePath) {
  if (typeof bundlePath !== 'string' || bundlePath.length === 0) {
    return 'unknown'
  }

  const parts = bundlePath.split('/')
  return parts[parts.length - 1] || bundlePath
}

function formatBuildTimeLabel(buildTime) {
  if (typeof buildTime !== 'string' || buildTime.length === 0) {
    return 'unknown build time'
  }

  const parsedDate = new Date(buildTime)
  if (Number.isNaN(parsedDate.getTime())) {
    return buildTime
  }

  return parsedDate.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function getBuildInfo({
  version = DEFAULT_VERSION,
  gitSha = DEFAULT_GIT_SHA,
  buildTime = DEFAULT_BUILD_TIME,
  runtimeOptions,
  document = globalThis.document,
} = {}) {
  const bundlePath = resolveBundlePath({ document })

  return {
    version,
    gitSha,
    buildTime,
    buildTimeLabel: formatBuildTimeLabel(buildTime),
    runtimeEnvironment: getRuntimeEnvironment(runtimeOptions),
    bundlePath,
    bundleId: resolveBundleId(bundlePath),
  }
}

export function logBuildInfoOnce(options = {}) {
  const buildInfo = getBuildInfo(options)
  if (hasLoggedBuildInfo) {
    return buildInfo
  }

  console.info(
    '[build]',
    `v${buildInfo.version}`,
    `sha=${buildInfo.gitSha}`,
    `built=${buildInfo.buildTime}`,
    `runtime=${buildInfo.runtimeEnvironment}`,
    `bundle=${buildInfo.bundleId}`
  )

  hasLoggedBuildInfo = true
  return buildInfo
}

export function resetBuildInfoLogForTests() {
  hasLoggedBuildInfo = false
}
