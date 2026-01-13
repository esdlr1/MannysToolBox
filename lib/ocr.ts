/**
 * OCR (Optical Character Recognition) utilities
 * For extracting text from notepad images
 */

/**
 * Extract text from image using OCR
 * 
 * Note: This is a placeholder. In production, you might want to use:
 * - Google Cloud Vision API
 * - AWS Textract
 * - Tesseract.js (client-side)
 * - Azure Computer Vision
 * 
 * For now, this returns null. Implement based on your OCR provider.
 */
export async function extractTextFromImage(imagePath: string): Promise<string | null> {
  // TODO: Implement OCR using your preferred service
  // Example with Google Cloud Vision:
  // const vision = require('@google-cloud/vision')
  // const client = new vision.ImageAnnotatorClient()
  // const [result] = await client.textDetection(imagePath)
  // return result.textAnnotations?.[0]?.description || null

  // For now, return null (OCR is optional feature)
  return null
}

/**
 * Search submissions by extracted text
 */
export async function searchSubmissionsByText(searchQuery: string) {
  const { prisma } = await import('@/lib/prisma')
  
  return await prisma.dailyNotepadSubmission.findMany({
    where: {
      ocrText: {
        contains: searchQuery,
        mode: 'insensitive',
      },
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
    orderBy: {
      submittedAt: 'desc',
    },
  })
}
