import { supabase } from './supabase'

export const IMAGES_BUCKET = 'images'

const MAX_BYTES = 5 * 1024 * 1024
// Photos are shrunk in the browser before uploading: at most 1600 px on the long side
// (profile pictures 512 px), saved as JPEG. Pages load faster and storage stays small.
const MAX_SIDE = { avatars: 512, default: 1600 }
const QUALITY = 0.82

async function shrink(file, maxSide) {
  // GIFs (could be animated) and SVGs are left alone; so is anything already small enough
  if (/gif|svg/.test(file.type) || typeof createImageBitmap === 'undefined') return file
  let bitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return file // e.g. HEIC the browser can't read: upload as it is
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  if (scale === 1 && file.size < 400 * 1024) {
    bitmap.close?.()
    return file
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff' // transparent PNGs get a white background as JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY))
  // Keep the original if shrinking didn't help
  if (!blob || blob.size >= file.size) return file
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
}

// folder groups images by feature, e.g. 'listings', 'chat', 'checklists', 'avatars'
export async function uploadImage(original, folder = 'listings') {
  if (!original.type.startsWith('image/')) throw new Error('Only image files can be uploaded.')
  // Big phone photos are fine: they're shrunk first, then checked
  const file = await shrink(original, MAX_SIDE[folder] || MAX_SIDE.default)
  if (file.size > MAX_BYTES) throw new Error('Image must be under 5 MB.')

  const ext = file.name.split('.').pop().toLowerCase()
  const path = `${folder}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage
    .from(IMAGES_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw error

  return { path, url: getImageUrl(path) }
}

export function getImageUrl(path) {
  return supabase.storage.from(IMAGES_BUCKET).getPublicUrl(path).data.publicUrl
}

export async function deleteImage(path) {
  const { error } = await supabase.storage.from(IMAGES_BUCKET).remove([path])
  if (error) throw error
}
