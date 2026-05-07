import { randomBytes, randomUUID, scrypt as scryptCallback } from 'node:crypto'
import { promisify } from 'node:util'
import { createError } from 'h3'
import { z } from 'zod'
import { userCount, createUser } from '../repositories/user-repository'
import { logger } from '../utils/logger'
import { parseValidatedBody } from '../utils/request-validator'

const scrypt = promisify(scryptCallback)

const setupRequestSchema = z.object({
    username: z.string().trim().min(1),
    password: z.string().trim().min(1),
})

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

    const { username, password } = await parseValidatedBody(event, setupRequestSchema, {
        onInvalid: (issues) => logger.warn('Rejected setup request with invalid payload.', { issues }),
    })

    if (!isStrongPassword(password)) {
        logger.warn('Rejected setup request because password does not meet strength requirements.', { username })
        throw createError({
            statusCode: 400,
            message: 'weak_password',
        })
    }

    const passwordHash = await hashPassword(password)
    const user = await createUser({
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
