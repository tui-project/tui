import { randomBytes, randomUUID, scrypt as scryptCallback } from 'node:crypto'
import { promisify } from 'node:util'
import { createError, readBody } from 'h3'
import { userCount, userCreate } from '../repositories/user-repository'
import { logger } from '../utils/logger'

const scrypt = promisify(scryptCallback)

interface SetupRequest {
    username?: string
    password?: string
}

function isStrongPassword(password: string) {
    const hasLower = /[a-z]/.test(password)
    const hasUpper = /[A-Z]/.test(password)
    const hasDigit = /\d/.test(password)
    const hasSpecial = /[^A-Za-z0-9]/.test(password)

    return hasLower && hasUpper && hasDigit && hasSpecial
}

async function hashPassword(password: string) {
    const salt = randomBytes(16).toString('hex')
    const derivedKey = (await scrypt(password, salt, 64)) as Buffer
    return `${salt}:${derivedKey.toString('hex')}`
}

export default defineEventHandler(async (event) => {
    logger.debug('Setup request received.')

    const totalUsers = await userCount()

    if (totalUsers > 0) {
        logger.warn('Rejected setup request because setup is already completed.', { userCount: totalUsers })
        throw createError({
            statusCode: 409,
            message: 'setup_completed',
        })
    }

    const request = await readBody<SetupRequest>(event)
    const username = request.username?.trim()
    const password = request.password?.trim()

    if (!username || !password) {
        logger.warn('Rejected setup request with missing required fields.', { hasUsername: Boolean(username), hasPassword: Boolean(password) })
        throw createError({
            statusCode: 400,
            message: 'invalid_request',
        })
    }

    if (!isStrongPassword(password)) {
        logger.warn('Rejected setup request because password does not meet strength requirements.', { username })
        throw createError({
            statusCode: 400,
            message: 'weak_password',
        })
    }

    const passwordHash = await hashPassword(password)
    const user = await userCreate({
        id: randomUUID(),
        username,
        passwordHash,
    })

    logger.info('Setup completed and admin user created.', { username })

    return {
        id: user.id,
        username: user.username,
    }
})
