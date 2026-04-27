import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import Datastore, { type Document } from '@seald-io/nedb'
import type { User } from '../model/user'

export const dataDir = process.env.DATABASE_DIR ?? join(process.cwd(), 'config', 'database')

mkdirSync(dataDir, { recursive: true })

export const usersDb = new Datastore<User>({
    filename: join(dataDir, 'users.db'),
    autoload: true,
    timestampData: true,
})

export type UserDocument = Document<User>
