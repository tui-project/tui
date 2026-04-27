import type { User } from '../model/user'
import { userCollection } from '../utils/db'

export async function create(user: User) {
    await userCollection.autoloadPromise
    return await userCollection.insertAsync(user)
}

export async function findAll() {
    await userCollection.autoloadPromise
    return await userCollection.findAsync({}).sort({ username: 1 })
}

export async function count() {
    await userCollection.autoloadPromise
    return await userCollection.countAsync({})
}
