export interface Language {
    iso_639_1: string
    english_name: string
}

export interface LanguageCacheMeta {
    _id: 'meta'
    refreshedAt: Date
}
