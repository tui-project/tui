import type { User } from '../model/user'
import { userCollection } from '../utils/db'

export async function createUser(user: User) {
    return await userCollection.insertAsync(user)
}

export async function findAllUsers() {
    return await userCollection.findAsync({}).sort({ username: 1 })
}

export async function userCount() {
    return await userCollection.countAsync({})
}

export async function findUserByUsername(username: string) {
    return await userCollection.findOneAsync({ username })
}
