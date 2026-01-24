import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

export const dynamic = 'force-dynamic'

// DELETE - Delete a material
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is Manager/Owner/Admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (!user || !['Manager', 'Owner', 'Super Admin'].includes(user.role || '')) {
      return NextResponse.json(
        { error: 'Forbidden - Manager/Owner access required' },
        { status: 403 }
      )
    }

    const material = await prisma.trainingMaterial.findUnique({
      where: { id: params.id },
    })

    if (!material) {
      return NextResponse.json(
        { error: 'Material not found' },
        { status: 404 }
      )
    }

    // Delete file if it exists
    if (material.fileUrl && material.fileUrl.startsWith('/api/training/files/')) {
      const filePath = material.fileUrl.replace('/api/training/files/', '')
      const fullPath = join(process.cwd(), 'uploads', 'training', filePath)
      if (existsSync(fullPath)) {
        try {
          await unlink(fullPath)
        } catch (error) {
          console.error('Error deleting file:', error)
        }
      }
    }

    await prisma.trainingMaterial.delete({
      where: { id: params.id },
    })

    return NextResponse.json({
      success: true,
      message: 'Material deleted successfully',
    })
  } catch (error) {
    console.error('Delete material error:', error)
    return NextResponse.json(
      { error: 'Failed to delete material' },
      { status: 500 }
    )
  }
}

// PUT - Update a material
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is Manager/Owner/Admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (!user || !['Manager', 'Owner', 'Super Admin'].includes(user.role || '')) {
      return NextResponse.json(
        { error: 'Forbidden - Manager/Owner access required' },
        { status: 403 }
      )
    }

    const { title, description, order } = await request.json()

    const material = await prisma.trainingMaterial.update({
      where: { id: params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(order !== undefined && { order: parseInt(order) }),
      },
    })

    return NextResponse.json({
      success: true,
      material,
    })
  } catch (error) {
    console.error('Update material error:', error)
    return NextResponse.json(
      { error: 'Failed to update material' },
      { status: 500 }
    )
  }
}
