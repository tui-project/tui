import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

describe('GET /api/setup/status', async () => {
    await setup()

    // Keep the empty-state assertion first: this e2e file shares one Nuxt runtime,
    // and cross-runtime datastore state can leak after creating a user.
    it("returns setupRequired as true when a user doesn't exists", async () => {
        await expect($fetch('/api/setup/status')).resolves.toEqual({
            setupRequired: true,
        })
    })

    it('returns setupRequired as false when a user exists', async () => {
        await $fetch('/api/users', {
            method: 'POST',
            body: {
                id: 'user-1',
                username: 'abc',
                passwordHash: 'hashed-password',
            },
        })

        await expect($fetch('/api/setup/status')).resolves.toEqual({
            setupRequired: false,
        })
    })
})
