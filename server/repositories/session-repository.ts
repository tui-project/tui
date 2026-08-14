import type { Session } from '../model/session'
import { sessionCollection } from '../utils/db'
import { createLogger } from '../utils/logger'

const logger = createLogger('repository:session')

export async function createSession(session: Session) {
    logger.trace('Creating session record.')
    return await sessionCollection.insertAsync(session)
}

export async function findActiveSessionById(id: string, nowIso = new Date().toISOString()) {
    logger.trace('Finding active session record.')
    return await sessionCollection.findOneAsync({
        id,
        expiresAt: { $gt: nowIso },
    })
}

export async function deleteExpiredSessions(nowIso = new Date().toISOString()) {
    logger.trace('Deleting expired session records.')
    return await sessionCollection.removeAsync(
        {
            expiresAt: { $lte: nowIso },
        },
        { multi: true }
    )
}

export async function removeSessionById(id: string) {
    logger.trace('Removing session record.')
    return await sessionCollection.removeAsync({ id }, {})
}
