import type { Session } from '../model/session'
import { sessionCollection } from '../utils/db'

export async function createSession(session: Session) {
    await sessionCollection.autoloadPromise
    return await sessionCollection.insertAsync(session)
}

export async function findActiveSessionById(id: string, nowIso = new Date().toISOString()) {
    await sessionCollection.autoloadPromise
    return await sessionCollection.findOneAsync({
        id,
        expiresAt: { $gt: nowIso },
    })
}

export async function deleteExpiredSessions(nowIso = new Date().toISOString()) {
    await sessionCollection.autoloadPromise
    return await sessionCollection.removeAsync(
        {
            expiresAt: { $lte: nowIso },
        },
        { multi: true }
    )
}

export async function removeSessionById(id: string) {
    await sessionCollection.autoloadPromise
    return await sessionCollection.removeAsync({ id }, {})
}
