// Best-effort claim metadata from an estimate's first pages — powers the
// zero-typing flow: client, claim number, and estimator are printed on
// page 1 of every Xactimate/Symbility report, so the user never types them.
import { PdfPage } from './types'

export interface EstimateMetadata {
  clientName: string | null
  claimNumber: string | null
  estimatorName: string | null
  estimateName: string | null
}

/**
 * Labels that appear on the header pages. Several can share one visual line
 * ("Claim Number: Policy Number: Type of Loss:"), so a captured value stops
 * at the next known label.
 */
const LABELS = [
  'Insured',
  'Property',
  'Home',
  'Business',
  'Estimator',
  'Claim Number',
  'Policy Number',
  'Type of Loss',
  'Date of Loss',
  'Date Received',
  'Date Inspected',
  'Date Entered',
  'Price List',
  'Estimate',
  'E-mail',
  'Position',
  'Company',
] as const

const LABEL_ALTERNATION = LABELS.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')

function captureAfter(label: string, text: string): string | null {
  const re = new RegExp(`${label}:\\s*(.*?)(?=\\s*(?:${LABEL_ALTERNATION}):|$)`, 'i')
  const match = text.match(re)
  const value = match?.[1]?.trim() ?? ''
  return value.length > 0 ? value : null
}

export function extractMetadata(pages: PdfPage[]): EstimateMetadata {
  const lines = pages.slice(0, 2).flatMap((page) => page.lines.map((line) => line.text))

  let clientName: string | null = null
  let claimNumber: string | null = null
  let estimatorName: string | null = null
  let estimateName: string | null = null

  for (const line of lines) {
    clientName = clientName ?? captureAfter('Insured', line)
    claimNumber = claimNumber ?? captureAfter('Claim Number', line)
    estimatorName = estimatorName ?? captureAfter('Estimator', line)
    estimateName = estimateName ?? captureAfter('Estimate', line)
  }

  return { clientName, claimNumber, estimatorName, estimateName }
}
