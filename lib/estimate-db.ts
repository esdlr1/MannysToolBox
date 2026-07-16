// Persist parsed estimates to the corpus (server-side only).
import { prisma } from './prisma'
import { ParseOutcome } from './estimate-engine'

export interface PersistedDocument {
  documentId: string
  /** lineNumber → EstimateLine id, for wiring match rows. */
  lineIdByNumber: Map<number, string>
}

export async function persistEstimateDocument(
  outcome: ParseOutcome,
  params: { userId: string; fileId: string | null; side: 'mine' | 'carrier' | 'unknown' }
): Promise<PersistedDocument> {
  const { document, reconciliation, metadata } = outcome
  if (!document || !reconciliation) {
    throw new Error('Cannot persist an estimate that did not parse')
  }

  const created = await prisma.estimateDocument.create({
    include: { lines: { select: { id: true, lineNumber: true } } },
    data: {
      userId: params.userId,
      fileId: params.fileId,
      side: params.side,
      format: outcome.format,
      parseMethod: document.parseMethod,
      gatePassed: reconciliation.ok,
      clientName: metadata?.clientName ?? null,
      claimNumber: metadata?.claimNumber ?? null,
      estimatorName: metadata?.estimatorName ?? null,
      grandRcvCents: reconciliation.printedGrandRcvCents,
      roomCount: document.rooms.length,
      itemCount: document.lineItems.length,
      warnings: document.warnings,
      lines: {
        create: document.lineItems.map((item) => ({
          lineNumber: item.lineNumber,
          room: item.room,
          code: item.catalog?.code ?? null,
          category: item.catalog?.category ?? null,
          action: item.action ?? null,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPriceCents: item.unitPriceCents,
          taxCents: item.taxCents,
          opCents: item.opCents,
          rcvCents: item.rcvCents,
          depreciationCents: item.depreciationCents,
          acvCents: item.acvCents,
          measurementBasis: item.measurementBasis ?? null,
        })),
      },
    },
  })

  return {
    documentId: created.id,
    lineIdByNumber: new Map(created.lines.map((line) => [line.lineNumber, line.id])),
  }
}
