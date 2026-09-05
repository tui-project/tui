import { appendFileSync, existsSync, mkdirSync, renameSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { createConsola, LogLevels, type ConsolaInstance, type LogObject } from 'consola'
import { publishLog } from '../events/log'

const sensitiveFields = new Set([
    'password',
    'passwordhash',
    'sessionid',
    'authorization',
    'proxyauthorization',
    'cookie',
    'setcookie',
    'passkey',
    'torrentdownloadurl',
    'announceurl',
])

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
let nextLogId = 1

const reporters = [...baseLogger.options.reporters, { log: captureLog }]
baseLogger.setReporters([
    {
        log(logObj, context) {
            const sanitizedLog = { ...logObj, args: logObj.args.map((arg) => redactLogValue(arg)) }
            for (const reporter of reporters) reporter.log(sanitizedLog, context)
        },
    },
])

function captureLog(logObj: LogObject) {
    const entry = createLogEntry(logObj)

    if (logBufferSize > 0) {
        recentLogs.push(entry)
        recentLogs.splice(0, Math.max(0, recentLogs.length - logBufferSize))
    }

    publishLog(entry)

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

// Keep secrets in structured fields, never interpolated into log messages.
function redactLogValue(value: unknown): unknown {
    return redactValue(value, new WeakSet<object>())
}

function redactValue(value: unknown, ancestors: WeakSet<object>): unknown {
    if (typeof value === 'string') return isSensitiveUrl(value) ? '[REDACTED]' : value
    if (value === null || typeof value !== 'object') return value
    if (ancestors.has(value)) return '[Circular]'

    if (value instanceof Error) {
        // HTTP errors can include credential-bearing request URLs and request objects.
        // Project only diagnostic text; do not copy request/response/header properties.
        const error = new Error(redactErrorUrls(value.message))
        error.name = value.name
        error.stack = value.stack === undefined ? undefined : redactErrorUrls(value.stack)
        return error
    }

    if (value instanceof Date) return value.toJSON()

    ancestors.add(value)
    const redacted = Array.isArray(value)
        ? value.map((item) => redactValue(item, ancestors))
        : Object.fromEntries(Object.entries(value).map(([key, item]) => [key, isSensitiveField(key) ? '[REDACTED]' : redactValue(item, ancestors)]))
    ancestors.delete(value)
    return redacted
}

function redactErrorUrls(text: string) {
    return text.replace(/https?:\/\/[^\s"'<>]+/gi, '[REDACTED URL]')
}

function isSensitiveField(key: string) {
    const normalized = normalizeField(key)
    return sensitiveFields.has(normalized) || normalized.endsWith('apikey') || normalized.endsWith('token') || normalized.endsWith('secret')
}

function normalizeField(key: string) {
    return key.replace(/[-_]/g, '').toLowerCase()
}

function isSensitiveUrl(value: string) {
    try {
        const url = new URL(value)
        const pathSegments = url.pathname.toLowerCase().split('/')
        const hasSensitivePath = pathSegments.includes('announce') || pathSegments.includes('download')
        const hasSensitiveCredentials = Boolean(url.username || url.password) || [...url.searchParams.keys()].some(isSensitiveField)
        return hasSensitivePath || hasSensitiveCredentials
    } catch {
        return false
    }
}
