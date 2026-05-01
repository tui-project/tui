import type { User } from '../model/user'
import { userCollection } from '../utils/db'

export async function createUser(user: User) {
    await userCollection.autoloadPromise
    return await userCollection.insertAsync(user)
}

export async function findAllUsers() {
    await userCollection.autoloadPromise
    return await userCollection.findAsync({}).sort({ username: 1 })
}

export async function userCount() {
    await userCollection.autoloadPromise
    return await userCollection.countAsync({})
}

export async function findUserByUsername(username: string) {
    await userCollection.autoloadPromise
    return await userCollection.findOneAsync({ username })
}
