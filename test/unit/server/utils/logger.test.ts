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

    return import('../../../../server/utils/logger')
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
    it('buffers recent logs and publishes new entries to subscribers', async () => {
        const { createLogger, getRecentLogs, subscribeToLogs } = await importLogger('5', { LOG_BUFFER_SIZE: '2' })
        const received: LogEntry[] = []
        const unsubscribe = subscribeToLogs((entry) => received.push(entry))
        const logger = createLogger('stream')

        logger.info('one')
        logger.warn('two')
        unsubscribe()
        logger.error('three')

        expect(received.map((entry) => entry.msg)).toEqual(['one', 'two'])
        expect(getRecentLogs().map((entry) => entry.msg)).toEqual(['two', 'three'])
        expect(getRecentLogs()[0]).toMatchObject({ id: 2, scope: 'stream', type: 'warn' })
        expect(typeof getRecentLogs()[0]?.time).toBe('string')
    })

    it('can disable the in-memory log buffer while still publishing entries', async () => {
        const { createLogger, getRecentLogs, subscribeToLogs } = await importLogger('5', { LOG_BUFFER_SIZE: '0' })
        const subscriber = vi.fn()
        subscribeToLogs(subscriber)

        createLogger('stream').info('published only')

        expect(subscriber).toHaveBeenCalledOnce()
        expect(getRecentLogs()).toEqual([])
    })

    it('writes log entries to a file with a msg field', async () => {
        const { createLogger } = await importLogger()
        const logger = createLogger('database')

        logger.info('Database initialised.')

        const logs = await readLogLines()

        expect(logs).toHaveLength(1)
        expect(logs[0]).toMatchObject({
            type: 'info',
            scope: 'database',
            msg: 'Database initialised.',
        })
        expect(logs[0]).not.toHaveProperty('args')
        expect(logs[0]).not.toHaveProperty('tag')
    })

    it('omits scope from file entries when the logger has no tag', async () => {
        const { createLogger } = await importLogger()

        createLogger('').info('Untagged message')

        const logs = await readLogLines()
        expect(logs[0]).toMatchObject({ type: 'info', msg: 'Untagged message' })
        expect(logs[0]).not.toHaveProperty('scope')
    })

    it('serializes additional values into the msg field and context', async () => {
        const { createLogger } = await importLogger()

        createLogger('test').info('Created user', { id: 'user-1', username: 'abc' })

        const logs = await readLogLines()

        expect(logs[0]?.msg).toBe('Created user')
        expect(logs[0]?.context).toEqual({ id: 'user-1', username: 'abc' })
    })

    it('serializes multiple context objects as an array', async () => {
        const { createLogger } = await importLogger()

        createLogger('test').info('Context batch', { id: 'user-1' }, { source: 'setup' })

        const logs = await readLogLines()
        expect(logs[0]?.msg).toBe('Context batch')
        expect(logs[0]?.context).toEqual([{ id: 'user-1' }, { source: 'setup' }])
    })

    it('uses compact trace output without a stack trace', async () => {
        const { createLogger } = await importLogger()
        const logger = createLogger('database')
        const logSpy = vi.spyOn(logger, '_log').mockImplementation(() => {})

        logger.trace('Initialising database')

        expect(logSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                args: ['Initialising database'],
                compactTrace: true,
                icon: '→',
                level: 5,
                tag: 'database',
                type: '→',
            })
        )
    })

    it('writes compact trace entries to file with the trace type', async () => {
        const { createLogger } = await importLogger()
        const logger = createLogger('database')

        logger.trace('Initialising database')

        const logs = await readLogLines()
        expect(logs[0]).toMatchObject({ type: 'trace', scope: 'database', msg: 'Initialising database' })
    })

    it('does not write debug logs below the configured log level', async () => {
        const { createLogger } = await importLogger('3')

        createLogger('test').debug('Hidden debug message')
        createLogger('test').trace('Hidden trace message')
        createLogger('test').info('Visible info message')

        const logs = await readLogLines()

        expect(logs).toHaveLength(1)
        expect(logs[0]?.msg).toBe('Visible info message')
    })

    it('rotates log files when the active file exceeds the configured size', async () => {
        const { createLogger } = await importLogger('5', {
            LOG_MAX_BYTES: '180',
            LOG_MAX_FILES: '2',
        })

        createLogger('test').info('First message that should live in the first file')
        createLogger('test').info('Second message that should rotate the active file')

        const activeLog = await readFile(join(getLogDir(), 'server.log'), 'utf8')
        const rotatedLog = await readFile(join(getLogDir(), 'server.log.1'), 'utf8')

        expect(activeLog).toContain('Second message')
        expect(rotatedLog).toContain('First message')
    })

    it('keeps only the configured number of rotated log files', async () => {
        const { createLogger } = await importLogger('5', {
            LOG_MAX_BYTES: '120',
            LOG_MAX_FILES: '2',
        })

        createLogger('test').info('First message that will be rotated away eventually')
        createLogger('test').info('Second message that becomes a rotated file')
        createLogger('test').info('Third message that becomes the active file')
        createLogger('test').info('Fourth message that should remove the oldest rotation')

        const logFiles = await readdir(getLogDir())

        expect(logFiles.sort()).toEqual(['server.log', 'server.log.1', 'server.log.2'])
    })

    it('does not write to log file when file logs are turned off', async () => {
        const { createLogger } = await importLogger('5', {
            LOG_FILE_DISABLED: 'true',
        })

        createLogger('test').info('First message that will be rotated away eventually')
        createLogger('test').info('Second message that becomes a rotated file')
        createLogger('test').info('Third message that becomes the active file')
        createLogger('test').info('Fourth message that should remove the oldest rotation')

        const logFiles = await readdir(getLogDir())

        expect(logFiles.sort()).toEqual([])
    })

    it('serialises Error values using stack or message', async () => {
        const { createLogger } = await importLogger()
        const error = new Error('boom')
        error.stack = undefined

        createLogger('test').error('Operation failed', error)

        const logs = await readLogLines()
        expect(logs[0]?.msg).toContain('Operation failed boom')
    })

    it('does not rotate when rotation is disabled by config', async () => {
        const { createLogger } = await importLogger('5', {
            LOG_MAX_BYTES: '0',
            LOG_MAX_FILES: '2',
            LOG_FILE_DISABLED: 'false',
        })

        createLogger('test').info('one')
        createLogger('test').info('two')

        const logFiles = await readdir(getLogDir())
        expect(logFiles.sort()).toEqual(['server.log'])
    })

    it('serialises primitive non-string values in msg', async () => {
        const { createLogger } = await importLogger()

        createLogger('test').info('User count', 42)

        const logs = await readLogLines()
        expect(logs[0]?.msg).toBe('User count 42')
    })

    it('serialises null values in msg', async () => {
        const { createLogger } = await importLogger()

        createLogger('test').info('Nullable value', null)

        const logs = await readLogLines()
        expect(logs[0]?.msg).toBe('Nullable value null')
    })

    it('does not rotate when log size stays below max bytes', async () => {
        const { createLogger } = await importLogger('5', {
            LOG_MAX_BYTES: '100000',
            LOG_MAX_FILES: '2',
            LOG_FILE_DISABLED: 'false',
        })

        createLogger('test').info('small message')

        const logFiles = await readdir(getLogDir())
        expect(logFiles.sort()).toEqual(['server.log'])
    })

    it('does not rotate when an existing log plus next write is still under max', async () => {
        const { createLogger } = await importLogger('5', {
            LOG_MAX_BYTES: '100000',
            LOG_MAX_FILES: '2',
            LOG_FILE_DISABLED: 'false',
        })

        createLogger('test').info('first small message')
        createLogger('test').info('second small message')

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

            const { createLogger } = await import('../../../../server/utils/logger')
            createLogger('test').info('default log dir test')

            const logFiles = await readdir(join(tempCwd, 'config', 'logs'))
            expect(logFiles).toContain('server.log')
        } finally {
            process.chdir(originalCwd)
        }
    })

    it('setLogLevel changes the active log level at runtime', async () => {
        const { createLogger, setLogLevel } = await importLogger('3')
        const logger = createLogger('runtime')

        logger.info('visible before change')
        setLogLevel(5)
        logger.debug('visible after change')

        const logs = await readLogLines()
        expect(logs).toHaveLength(2)
        expect(logs[0]?.msg).toBe('visible before change')
        expect(logs[1]?.msg).toBe('visible after change')
    })

    it('filters compact trace logs after the log level changes at runtime', async () => {
        const { createLogger, setLogLevel } = await importLogger('5')
        const logger = createLogger('runtime')

        logger.trace('visible before change')
        setLogLevel(3)
        logger.trace('hidden after change')
        logger.info('visible after change')

        const logs = await readLogLines()
        expect(logs.map((log) => log.msg)).toEqual(['visible before change', 'visible after change'])
    })

    it('uses default LOG_LEVEL of 5 (debug) when LOG_LEVEL is not set', async () => {
        process.env.LOG_DIR = getLogDir()
        process.env.LOG_FILE_DISABLED = 'false'
        delete process.env.LOG_LEVEL

        vi.resetModules()
        const { createLogger } = await import('../../../../server/utils/logger')

        createLogger('test').debug('visible at default level')
        createLogger('test').error('also visible at default level')

        const logs = await readLogLines()
        expect(logs).toHaveLength(2)
        expect(logs[0]?.msg).toBe('visible at default level')
        expect(logs[1]?.msg).toBe('also visible at default level')
    })
})
