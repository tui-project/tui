import type { TorrentClientSettings } from '../model/settings'
import { logger } from '../utils/logger'

export async function injectTorrent(torrentDownloadUrl: string, client: TorrentClientSettings): Promise<boolean> {
    if (client.code === 'QUI') {
        return injectViaQui(torrentDownloadUrl, client)
    }

    logger.warn('Unsupported torrent client code, skipping injection.', { code: client.code })
    return false
}

async function injectViaQui(torrentDownloadUrl: string, client: TorrentClientSettings): Promise<boolean> {
    try {
        const torrentBuffer = await $fetch<ArrayBuffer>(torrentDownloadUrl, { responseType: 'arrayBuffer' })
        const torrentData = Buffer.from(torrentBuffer).toString('base64')

        await $fetch(`${client.url}/api/cross-seed/apply`, {
            method: 'POST',
            headers: { 'X-API-Key': client.apiKey },
            body: {
                torrentData,
                tags: ['tui'],
                instanceIds: [1],
                skipIfExists: true,
            },
        })

        logger.info('qui injection succeeded.', { torrentDownloadUrl, quiUrl: client.url })
        return true
    } catch (error: unknown) {
        logger.error('qui injection failed.', error, { torrentDownloadUrl, quiUrl: client.url })
        return false
    }
}
