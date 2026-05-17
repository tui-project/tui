import { readFile, readdir } from 'node:fs/promises'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { getLogDir } from '../../setupFile'

async function importLogger(level = '5', extraEnv: Record<string, string> = {}) {
    process.env.LOG_LEVEL = level
    process.env.LOG_FILE_DISABLED = 'false'

    for (const [key, value] of Object.entries(extraEnv)) {
        process.env[key] = value
    }

    return await import('../../../../server/utils/logger')
}

async function readLogLines() {
    const logFile = join(getLogDir(), 'server.log')
    const contents = await readFile(logFile, 'utf8')

    return contents
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as Record<string, unknown>)
}

describe('server logger', () => {
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

    it('serializes additional values into the msg field and context', async () => {
        const { logger } = await importLogger()

        logger.info('Created user', { id: 'user-1', username: 'abc' })

        const logs = await readLogLines()

        expect(logs[0]?.msg).toBe('Created user')
        expect(logs[0]?.context).toEqual({ id: 'user-1', username: 'abc' })
    })

    it('serializes multiple context objects as an array', async () => {
        const { logger } = await importLogger()

        logger.info('Context batch', { id: 'user-1' }, { source: 'setup' })

        const logs = await readLogLines()
        expect(logs[0]?.msg).toBe('Context batch')
        expect(logs[0]?.context).toEqual([{ id: 'user-1' }, { source: 'setup' }])
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
                type: 'trace',
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

        const activeLog = await readFile(join(getLogDir(), 'server.log'), 'utf8')
        const rotatedLog = await readFile(join(getLogDir(), 'server.log.1'), 'utf8')

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

        const logFiles = await readdir(getLogDir())

        expect(logFiles.sort()).toEqual(['server.log', 'server.log.1', 'server.log.2'])
    })

    it('does not write to log file when file logs are turned off', async () => {
        const { logger } = await importLogger('5', {
            LOG_FILE_DISABLED: 'true',
        })

        logger.info('First message that will be rotated away eventually')
        logger.info('Second message that becomes a rotated file')
        logger.info('Third message that becomes the active file')
        logger.info('Fourth message that should remove the oldest rotation')

        const logFiles = await readdir(getLogDir())

        expect(logFiles.sort()).toEqual([])
    })

    it('serialises Error values using stack or message', async () => {
        const { logger } = await importLogger()
        const error = new Error('boom')
        error.stack = undefined

        logger.error('Operation failed', error)

        const logs = await readLogLines()
        expect(logs[0]?.msg).toContain('Operation failed boom')
    })

    it('does not rotate when rotation is disabled by config', async () => {
        const { logger } = await importLogger('5', {
            LOG_MAX_BYTES: '0',
            LOG_MAX_FILES: '2',
            LOG_FILE_DISABLED: 'false',
        })

        logger.info('one')
        logger.info('two')

        const logFiles = await readdir(getLogDir())
        expect(logFiles.sort()).toEqual(['server.log'])
    })

    it('serialises primitive non-string values in msg', async () => {
        const { logger } = await importLogger()

        logger.info('User count', 42)

        const logs = await readLogLines()
        expect(logs[0]?.msg).toBe('User count 42')
    })

    it('serialises null values in msg', async () => {
        const { logger } = await importLogger()

        logger.info('Nullable value', null)

        const logs = await readLogLines()
        expect(logs[0]?.msg).toBe('Nullable value null')
    })

    it('does not rotate when log size stays below max bytes', async () => {
        const { logger } = await importLogger('5', {
            LOG_MAX_BYTES: '100000',
            LOG_MAX_FILES: '2',
            LOG_FILE_DISABLED: 'false',
        })

        logger.info('small message')

        const logFiles = await readdir(getLogDir())
        expect(logFiles.sort()).toEqual(['server.log'])
    })

    it('does not rotate when an existing log plus next write is still under max', async () => {
        const { logger } = await importLogger('5', {
            LOG_MAX_BYTES: '100000',
            LOG_MAX_FILES: '2',
            LOG_FILE_DISABLED: 'false',
        })

        logger.info('first small message')
        logger.info('second small message')

        const logFiles = await readdir(getLogDir())
        expect(logFiles.sort()).toEqual(['server.log'])
    })

    it('uses default LOG_DIR when LOG_DIR is not set', async () => {
        const originalCwd = process.cwd()
        const tempCwd = mkdtempSync(join(tmpdir(), 'tui-unit-log-cwd-'))

        try {
            process.env.LOG_FILE_DISABLED = 'false'
            delete process.env.LOG_DIR
            process.chdir(tempCwd)
            vi.resetModules()

            const { logger } = await import('../../../../server/utils/logger')
            logger.info('default log dir test')

            const logFiles = await readdir(join(tempCwd, 'config', 'logs'))
            expect(logFiles).toContain('server.log')
        } finally {
            process.chdir(originalCwd)
        }
    })

    it('setLogLevel changes the active log level at runtime', async () => {
        const { logger, setLogLevel } = await importLogger('3')

        logger.info('visible before change')
        setLogLevel(5)
        logger.debug('visible after change')

        const logs = await readLogLines()
        expect(logs).toHaveLength(2)
        expect(logs[0]?.msg).toBe('visible before change')
        expect(logs[1]?.msg).toBe('visible after change')
    })

    it('uses default LOG_LEVEL of 5 (debug) when LOG_LEVEL is not set', async () => {
        process.env.LOG_DIR = getLogDir()
        process.env.LOG_FILE_DISABLED = 'false'
        delete process.env.LOG_LEVEL

        vi.resetModules()
        const { logger } = await import('../../../../server/utils/logger')

        logger.debug('visible at default level')
        logger.error('also visible at default level')

        const logs = await readLogLines()
        expect(logs).toHaveLength(2)
        expect(logs[0]?.msg).toBe('visible at default level')
        expect(logs[1]?.msg).toBe('also visible at default level')
    })
})
