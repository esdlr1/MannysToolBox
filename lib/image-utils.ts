import sharp from 'sharp'
import { promises as fs } from 'fs'
import path from 'path'

const UPLOAD_DIR = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads/daily-notepad')
const THUMBNAIL_DIR = path.join(UPLOAD_DIR, 'thumbnails')

/**
 * Ensure directories exist
 */
async function ensureDirectories() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true })
  await fs.mkdir(THUMBNAIL_DIR, { recursive: true })
}

/**
 * Optimize image (compress and resize if needed)
 * Returns optimized image buffer and file size
 */
export async function optimizeImage(
  imageBuffer: Buffer,
  maxWidth = 1920,
  maxHeight = 1920,
  quality = 85
): Promise<{ buffer: Buffer; size: number }> {
  const image = sharp(imageBuffer)
  const metadata = await image.metadata()

  // Resize if too large
  let processed = image
  if (metadata.width && metadata.height) {
    if (metadata.width > maxWidth || metadata.height > maxHeight) {
      processed = image.resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      })
    }
  }

  // Optimize based on format
  let optimizedBuffer: Buffer
  if (metadata.format === 'jpeg' || metadata.format === 'jpg') {
    optimizedBuffer = await processed.jpeg({ quality }).toBuffer()
  } else if (metadata.format === 'png') {
    optimizedBuffer = await processed.png({ quality }).toBuffer()
  } else if (metadata.format === 'webp') {
    optimizedBuffer = await processed.webp({ quality }).toBuffer()
  } else {
    // Convert to JPEG for other formats
    optimizedBuffer = await processed.jpeg({ quality }).toBuffer()
  }

  return {
    buffer: optimizedBuffer,
    size: optimizedBuffer.length,
  }
}

/**
 * Generate thumbnail from image
 * Returns thumbnail buffer
 */
export async function generateThumbnail(
  imageBuffer: Buffer,
  width = 300,
  height = 300
): Promise<Buffer> {
  return await sharp(imageBuffer)
    .resize(width, height, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 80 })
    .toBuffer()
}

/**
 * Save image and generate thumbnail
 * Returns paths to saved files
 */
export async function saveImageWithThumbnail(
  imageBuffer: Buffer,
  filename: string
): Promise<{ imagePath: string; thumbnailPath: string; originalSize: number; optimizedSize: number }> {
  await ensureDirectories()

  // Optimize image
  const { buffer: optimizedBuffer, size: optimizedSize } = await optimizeImage(imageBuffer)
  const originalSize = imageBuffer.length

  // Generate thumbnail
  const thumbnailBuffer = await generateThumbnail(optimizedBuffer)

  // Save optimized image
  const imagePath = path.join(UPLOAD_DIR, filename)
  await fs.writeFile(imagePath, optimizedBuffer)

  // Save thumbnail
  const thumbnailFilename = `thumb_${filename}`
  const thumbnailPath = path.join(THUMBNAIL_DIR, thumbnailFilename)
  await fs.writeFile(thumbnailPath, thumbnailBuffer)

  return {
    imagePath,
    thumbnailPath,
    originalSize,
    optimizedSize,
  }
}

/**
 * Get image URL (for serving images)
 */
export function getImageUrl(imagePath: string): string {
  // In production, this might be a CDN URL
  // For now, return a relative path
  return `/api/files/${path.basename(imagePath)}`
}
