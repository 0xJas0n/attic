type Translate = (key: string) => string

export function getLocationNameError(name: string, t?: Translate): string | null {
  return name.trim() ? null : (t ? t('catalog.locations.nameRequired') : 'Location name is required')
}

export const maxLocationPhotoSize = 10 * 1024 * 1024

export function getLocationPhotoError(file: { size: number, type: string }, t?: Translate): string | null {
  if (file.size > maxLocationPhotoSize) return t ? t('catalog.locations.photoTooLarge') : 'Choose a photo smaller than 10 MB.'
  if (file.type && !['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) return t ? t('catalog.locations.photoBadType') : 'Choose a JPEG, PNG or GIF photo.'
  return null
}
