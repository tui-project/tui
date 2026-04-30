import type { Session } from '../model/session'
import { sessionCollection } from '../utils/db'

export async function create(session: Session) {
    await sessionCollection.autoloadPromise
    return await sessionCollection.insertAsync(session)
}

export async function findActiveById(id: string, nowIso = new Date().toISOString()) {
    await sessionCollection.autoloadPromise
    return await sessionCollection.findOneAsync({
        id,
        expiresAt: { $gt: nowIso },
    })
}

export async function deleteExpired(nowIso = new Date().toISOString()) {
    await sessionCollection.autoloadPromise
    return await sessionCollection.removeAsync(
        {
            expiresAt: { $lte: nowIso },
        },
        { multi: true },
    )
}
