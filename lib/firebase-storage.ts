import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage"
import { storage } from "./firebase"

export async function uploadImage(
  file: File,
  path: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  const storageRef = ref(storage, path)
  const uploadTask = uploadBytesResumable(storageRef, file)

  return new Promise((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        onProgress?.(progress)
      },
      (error) => reject(error),
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref)
        resolve(url)
      }
    )
  })
}

export async function deleteImage(url: string) {
  try {
    const storageRef = ref(storage, url)
    await deleteObject(storageRef)
  } catch {
    // Image may already be deleted
  }
}

export function getListingImagePath(listingId: string, fileName: string) {
  return `listings/${listingId}/${Date.now()}_${fileName}`
}

export function getBannerImagePath(fileName: string) {
  return `banners/${Date.now()}_${fileName}`
}

export function getSiteLogoPath(fileName: string) {
  return `branding/logo/${Date.now()}_${fileName}`
}

export function getGalleryImagePath(fileName: string) {
  return `gallery/${Date.now()}_${fileName}`
}
