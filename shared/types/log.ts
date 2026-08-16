import { makeConst } from '../utils/make-const'

export const [LOG_TYPES, LOG_TYPE_OPTIONS] = makeConst({
    FATAL: { value: 'fatal', label: 'Fatal' },
    ERROR: { value: 'error', label: 'Error' },
    WARN: { value: 'warn', label: 'Warn' },
    INFO: { value: 'info', label: 'Info' },
    DEBUG: { value: 'debug', label: 'Debug' },
    TRACE: { value: 'trace', label: 'Trace' },
})
export type LogType = (typeof LOG_TYPES)[keyof typeof LOG_TYPES]

export interface LogEntry {
    id: number
    time: string
    type: LogType
    msg: string
    scope?: string
    context?: unknown
}
