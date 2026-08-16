import { appendFileSync, existsSync, mkdirSync, renameSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { createConsola, LogLevels, type ConsolaInstance, type LogObject } from 'consola'

const logDir = process.env.LOG_DIR ?? join(process.cwd(), 'config', 'logs')
const logFile = process.env.LOG_FILE ?? join(logDir, 'server.log')
const logMaxBytes = Number(process.env.LOG_MAX_BYTES ?? 5 * 1024 * 1024)
const logMaxFiles = Number(process.env.LOG_MAX_FILES ?? 5)
const logFileDisabled = process.env.LOG_FILE_DISABLED === 'true'
const logBufferSize = Number(process.env.LOG_BUFFER_SIZE ?? 1000)

mkdirSync(logDir, { recursive: true })

const baseLogger = createConsola({
    level: process.env.LOG_LEVEL ? Number(process.env.LOG_LEVEL) : 5,
    formatOptions: {
        depth: Infinity,
    },
})
const scopedLoggers: ConsolaInstance[] = []
const recentLogs: LogEntry[] = []
const logSubscribers = new Set<(entry: LogEntry) => void>()
let nextLogId = 1

baseLogger.addReporter({
    log: captureLog,
})

function captureLog(logObj: LogObject) {
    const entry = createLogEntry(logObj)

    if (logBufferSize > 0) {
        recentLogs.push(entry)
        recentLogs.splice(0, Math.max(0, recentLogs.length - logBufferSize))
    }

    for (const subscriber of logSubscribers) {
        subscriber(entry)
    }

    if (!logFileDisabled) {
        writeFileLog(entry)
    }
}

function createLogEntry(logObj: LogObject): LogEntry {
    const context = logObj.args.filter((arg) => typeof arg === 'object' && arg !== null && !(arg instanceof Error))
    const messageParts = logObj.args.filter((arg) => typeof arg !== 'object' || arg === null || arg instanceof Error).map(formatLogArg)

    const entry: LogEntry = {
        id: nextLogId++,
        time: logObj.date.toISOString(),
        type: logObj.compactTrace ? LOG_TYPES.TRACE : (logObj.type as LogType),
        msg: messageParts.join(' '),
    }

    if (logObj.tag) {
        entry.scope = logObj.tag
    }

    if (context.length > 0) {
        entry.context = context.length === 1 ? context[0] : context
    }

    return entry
}

function writeFileLog(entry: LogEntry) {
    const { id: _id, ...fileEntry } = entry
    const line = JSON.stringify(fileEntry)

    rotateLogFileIfNeeded(Buffer.byteLength(`${line}\n`))
    appendFileSync(logFile, `${line}\n`)
}

function formatLogArg(arg: unknown) {
    if (arg instanceof Error) {
        return arg.stack ?? arg.message
    }

    if (typeof arg === 'string') {
        return arg
    }

    if (typeof arg === 'object') {
        return JSON.stringify(arg)
    }

    return String(arg)
}

function rotateLogFileIfNeeded(nextWriteBytes: number) {
    if (logMaxBytes <= 0 || logMaxFiles <= 0 || !existsSync(logFile)) {
        return
    }

    const currentSize = statSync(logFile).size

    if (currentSize + nextWriteBytes <= logMaxBytes) {
        return
    }

    const oldestLogFile = `${logFile}.${logMaxFiles}`

    if (existsSync(oldestLogFile)) {
        unlinkSync(oldestLogFile)
    }

    for (let index = logMaxFiles - 1; index >= 1; index -= 1) {
        const source = `${logFile}.${index}`
        const target = `${logFile}.${index + 1}`

        if (existsSync(source)) {
            renameSync(source, target)
        }
    }

    renameSync(logFile, `${logFile}.1`)
}

export function createLogger(scope: string) {
    const scopedLogger = baseLogger.withTag(scope)

    function writeCompactTrace(...args: unknown[]) {
        if (LogLevels.trace > scopedLogger.level) {
            return
        }

        scopedLogger._log({ args, compactTrace: true, date: new Date(), icon: '→', level: LogLevels.trace, tag: scope, type: '→' as 'trace' })
    }

    scopedLogger.trace = Object.assign(writeCompactTrace, { raw: writeCompactTrace })
    scopedLoggers.push(scopedLogger)

    return scopedLogger
}

export function setLogLevel(level: number) {
    baseLogger.level = level

    for (const scopedLogger of scopedLoggers) {
        scopedLogger.level = level
    }
}

export function getRecentLogs() {
    return [...recentLogs]
}

export function subscribeToLogs(subscriber: (entry: LogEntry) => void) {
    logSubscribers.add(subscriber)

    return () => logSubscribers.delete(subscriber)
}
