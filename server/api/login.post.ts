import { randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { createError, setCookie } from 'h3'
import { z } from 'zod'
import { createSession } from '../repositories/session-repository'
import { findUserByUsername } from '../repositories/user-repository'
import { parseValidatedBody } from '../utils/request-validator'
import { logger } from '../utils/logger'

const scrypt = promisify(scryptCallback)
const SESSION_TTL_MS = 60 * 60 * 1000

const loginRequestSchema = z.object({
    username: z.string().trim().min(1),
    password: z.string().trim().min(1),
})

export default defineEventHandler(async (event) => {
    logger.debug('Login request received.')

    const { username, password } = await parseValidatedBody(event, loginRequestSchema, {
        onInvalid: (issues) => logger.warn('Rejected login request with invalid payload.', { issues }),
    })

    const user = await findUserByUsername(username)
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
        logger.warn('Rejected login request with invalid credentials.', { username })
        throw createError({
            statusCode: 401,
            message: 'invalid_credentials',
        })
    }

    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString()
    const session = await createSession({
        id: randomUUID(),
        userId: user.id,
        expiresAt,
    })

    setCookie(event, 'session_id', session.id, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        expires: new Date(session.expiresAt),
    })

    logger.info('Login succeeded and session created.', { userId: user.id, sessionId: session.id, expiresAt })

    return {
        sessionId: session.id,
        userId: session.userId,
        expiresAt: session.expiresAt,
    }
})

async function verifyPassword(password: string, passwordHash: string) {
    const [salt, storedHash] = passwordHash.split(':')

    if (!salt || !storedHash) {
        return false
    }

    const derivedKey = (await scrypt(password, salt, 64)) as Buffer
    const storedBuffer = Buffer.from(storedHash, 'hex')

    if (storedBuffer.length !== derivedKey.length) {
        return false
    }

    return timingSafeEqual(storedBuffer, derivedKey)
}
