import { supabase } from './supabase'

export const IMAGES_BUCKET = 'images'

const MAX_BYTES = 5 * 1024 * 1024

// folder groups images by feature, e.g. 'listings', 'chat', 'checklists'
export async function uploadImage(file, folder = 'listings') {
  if (!file.type.startsWith('image/')) throw new Error('Only image files can be uploaded.')
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
