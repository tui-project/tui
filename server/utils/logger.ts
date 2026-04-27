import { appendFileSync, existsSync, mkdirSync, renameSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { createConsola, type LogObject } from 'consola'

const logDir = process.env.LOG_DIR ?? join(process.cwd(), 'config', 'logs')
const logFile = process.env.LOG_FILE ?? join(logDir, 'server.log')
const logMaxBytes = Number(process.env.LOG_MAX_BYTES ?? 5 * 1024 * 1024)
const logMaxFiles = Number(process.env.LOG_MAX_FILES ?? 5)

mkdirSync(logDir, { recursive: true })

const baseLogger = createConsola({
    level: process.env.LOG_LEVEL ? Number(process.env.LOG_LEVEL) : 5,
})

baseLogger.addReporter({
    log: writeFileLog,
})

function writeFileLog(logObj: LogObject) {
    const line = JSON.stringify({
        time: logObj.date,
        type: logObj.type,
        tag: logObj.tag,
        msg: logObj.args.map(formatLogArg).join(' '),
    })

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

const serverLogger = baseLogger.withTag('server')

function writeCompactTrace(...args: unknown[]) {
    serverLogger._log({
        args,
        date: new Date(),
        level: 5,
        tag: 'server',
        type: 'debug',
    })
}

serverLogger.trace = Object.assign(writeCompactTrace, {
    raw: writeCompactTrace,
})

export const logger = serverLogger
