export interface UploadedImage {
    url: string
    displayUrl: string
}

export interface ImageUploadProvider {
    uploadImage(filePath: string): Promise<UploadedImage>
}
