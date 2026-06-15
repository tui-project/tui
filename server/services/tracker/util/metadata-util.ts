import type { TrackerUploadMetadata } from '../tracker'

export function isDvd(metadata: TrackerUploadMetadata): boolean {
    return metadata.source === SOURCES.DVD || metadata.source === SOURCES.NTSC_DVD || metadata.source === SOURCES.PAL_DVD || metadata.source === SOURCES.HD_DVD
}

export function isRemux(metadata: TrackerUploadMetadata): boolean {
    return metadata.sourceType === SOURCE_TYPES.REMUX
}

export function isHdtv(metadata: TrackerUploadMetadata): boolean {
    return metadata.sourceType === SOURCE_TYPES.HDTV
}

export function isEncode(metadata: TrackerUploadMetadata): boolean {
    return metadata.sourceType === SOURCE_TYPES.ENCODE
}

export function isForeignContent(metadata: TrackerUploadMetadata): boolean {
    return metadata.originalLanguage !== 'en'
}

export function hasEnglishAudio(metadata: TrackerUploadMetadata): boolean {
    return metadata.language.includes('en')
}

export function isWebSource(sourceType: SourceType) {
    return (WEB_SOURCE_TYPES as string[]).includes(sourceType)
}

export function isSDResolution(resolution: Resolution) {
    return (SD_RESOLUTIONS as string[]).includes(resolution)
}
