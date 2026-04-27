import { mkdtempSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let dataDir = ''
let logDir = ''

export function getDataDir() {
    return dataDir
}

export function getLogDir() {
    return logDir
}

export async function setup() {

    dataDir = mkdtempSync(join(tmpdir(), 'tui-e2e-db-'))
    logDir = mkdtempSync(join(tmpdir(), 'tui-e2e-log-'))

    process.env.DATABASE_DIR = dataDir
    process.env.LOG_DIR = logDir
    process.env.LOG_LEVEL = '5'
    process.env.LOG_FILE_DISABLED = 'true'
}

export async function teardown() {
    await Promise.all([
        rm(dataDir, { recursive: true, force: true }),
        rm(logDir, { recursive: true, force: true }),
    ])
}
