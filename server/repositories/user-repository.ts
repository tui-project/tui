import type { User } from '../model/user'
import { userCollection } from '../utils/db'
import { createLogger } from '../utils/logger'

const logger = createLogger('repository:user')

export async function createUser(user: User) {
    logger.trace('Creating user record.', { userId: user.id })
    return await userCollection.insertAsync(user)
}

export async function findAllUsers() {
    logger.trace('Finding all user records.')
    return await userCollection.findAsync({}).sort({ username: 1 })
}

export async function userCount() {
    logger.trace('Counting user records.')
    return await userCollection.countAsync({})
}

export async function findUserByUsername(username: string) {
    logger.trace('Finding user record by username.', { username })
    return await userCollection.findOneAsync({ username })
}
