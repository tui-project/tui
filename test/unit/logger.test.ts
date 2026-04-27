import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let logDir: string

async function importLogger(level = '5', extraEnv: Record<string, string> = {}) {
    vi.resetModules()
    logDir = await mkdtemp(join(tmpdir(), 'tui-logs-'))
    process.env.LOG_DIR = logDir
    process.env.LOG_LEVEL = level

    for (const [key, value] of Object.entries(extraEnv)) {
        process.env[key] = value
    }

    return await import('../../server/utils/logger')
}

async function readLogLines() {
    const logFile = join(logDir, 'server.log')
    const contents = await readFile(logFile, 'utf8')

    return contents
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as Record<string, unknown>)
}

describe('server logger', () => {
    beforeEach(() => {})

    afterEach(async () => {
        vi.restoreAllMocks()
        delete process.env.LOG_DIR
        delete process.env.LOG_FILE
        delete process.env.LOG_LEVEL

        if (logDir) {
            await rm(logDir, { recursive: true, force: true })
        }
    })

    it('writes log entries to a file with a msg field', async () => {
        const { logger } = await importLogger()

        logger.info('Database initialised.')

        const logs = await readLogLines()

        expect(logs).toHaveLength(1)
        expect(logs[0]).toMatchObject({
            type: 'info',
            tag: 'server',
            msg: 'Database initialised.',
        })
        expect(logs[0]).not.toHaveProperty('args')
    })

    it('serializes additional values into the msg field', async () => {
        const { logger } = await importLogger()

        logger.info('Created user', { id: 'user-1', username: 'abc' })

        const logs = await readLogLines()

        expect(logs[0]?.msg).toBe('Created user {"id":"user-1","username":"abc"}')
    })

    it('uses compact trace output without a stack trace', async () => {
        const { logger } = await importLogger()
        const logSpy = vi.spyOn(logger, '_log').mockImplementation(() => {})

        logger.trace('Initialising database')

        expect(logSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                args: ['Initialising database'],
                level: 5,
                tag: 'server',
                type: 'debug',
            })
        )
    })

    it('does not write debug logs below the configured log level', async () => {
        const { logger } = await importLogger('3')

        logger.debug('Hidden debug message')
        logger.info('Visible info message')

        const logs = await readLogLines()

        expect(logs).toHaveLength(1)
        expect(logs[0]?.msg).toBe('Visible info message')
    })

    it('rotates log files when the active file exceeds the configured size', async () => {
        const { logger } = await importLogger('5', {
            LOG_MAX_BYTES: '180',
            LOG_MAX_FILES: '2',
        })

        logger.info('First message that should live in the first file')
        logger.info('Second message that should rotate the active file')

        const activeLog = await readFile(join(logDir, 'server.log'), 'utf8')
        const rotatedLog = await readFile(join(logDir, 'server.log.1'), 'utf8')

        expect(activeLog).toContain('Second message')
        expect(rotatedLog).toContain('First message')
    })

    it('keeps only the configured number of rotated log files', async () => {
        const { logger } = await importLogger('5', {
            LOG_MAX_BYTES: '120',
            LOG_MAX_FILES: '2',
        })

        logger.info('First message that will be rotated away eventually')
        logger.info('Second message that becomes a rotated file')
        logger.info('Third message that becomes the active file')
        logger.info('Fourth message that should remove the oldest rotation')

        const logFiles = await readdir(logDir)

        expect(logFiles.sort()).toEqual(['server.log', 'server.log.1', 'server.log.2'])
    })
})
