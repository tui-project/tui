import { mkdtempSync } from 'node:fs'
import { readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, afterEach, vi } from 'vitest'
import * as log from '../../shared/types/log'
import * as language from '../../shared/types/language'
import * as metadata from '../../shared/types/metadata'
import * as trackerRequest from '../../shared/types/tracker-request'

Object.assign(globalThis, language, log, metadata, trackerRequest)

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

    if ((await readdir(dataDir)).length > 0) {
        const db = await import('../../server/utils/db')
        await Promise.all(
            [db.userCollection, db.sessionCollection, db.settingsCollection, db.directoryCacheCollection, db.genericTorrentCacheCollection, db.trackerUploadRequestCollection]
                .map((collection) => collection?.autoloadPromise)
                .filter((load): load is Promise<void> => load !== null && load !== undefined)
        )
    }

    delete process.env.DATABASE_DIR
    delete process.env.LOG_DIR
    delete process.env.LOG_FILE
    delete process.env.LOG_FILE_DISABLED
    delete process.env.LOG_LEVEL
    delete process.env.LOG_BUFFER_SIZE

    const cleanupOptions = {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 50,
    }

    await Promise.all([rm(dataDir, cleanupOptions), rm(logDir, cleanupOptions)])
})
