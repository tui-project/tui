import { mkdtempSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, afterEach, vi } from 'vitest'
import * as metadata from '../../shared/types/metadata'
import * as trackerRequest from '../../shared/types/tracker-request'

Object.assign(globalThis, metadata, trackerRequest)

let dataDir = ''
let logDir = ''

export function getDataDir() {
    return dataDir
}

export function getLogDir() {
    return logDir
}

beforeEach(async () => {
    vi.resetModules()

    dataDir = mkdtempSync(join(tmpdir(), 'tui-unit-db-'))
    logDir = mkdtempSync(join(tmpdir(), 'tui-unit-log-'))

    process.env.DATABASE_DIR = dataDir
    process.env.LOG_DIR = logDir
    process.env.LOG_LEVEL = '5'
    process.env.LOG_FILE_DISABLED = 'true'
})

afterEach(async () => {
    vi.restoreAllMocks()

    delete process.env.DATABASE_DIR
    delete process.env.LOG_DIR
    delete process.env.LOG_FILE
    delete process.env.LOG_FILE_DISABLED
    delete process.env.LOG_LEVEL

    await Promise.all([rm(dataDir, { recursive: true, force: true }), rm(logDir, { recursive: true, force: true })])
})
