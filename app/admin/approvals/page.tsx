'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Check, X, Loader2, User, Shield } from 'lucide-react'

interface PendingUser {
  id: string
  email: string
  name: string | null
  role: string
  createdAt: string
}

export default function AdminApprovalsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/auth/signin')
      return
    }

    // Check if user is Super Admin
    if (session.user?.role !== 'Super Admin') {
      router.push('/')
      return
    }

    fetchPendingUsers()
  }, [session, status, router])

  const fetchPendingUsers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/approve-users')
      if (!response.ok) {
        throw new Error('Failed to fetch pending users')
      }
      const data = await response.json()
      setPendingUsers(data.users || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load pending users')
    } finally {
      setLoading(false)
    }
  }

  const handleApproval = async (userId: string, approved: boolean) => {
    try {
      setProcessing(userId)
      setError('')

      const response = await fetch('/api/admin/approve-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, approved }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update approval status')
      }

      // Remove user from pending list if approved
      setPendingUsers((prev) => prev.filter((user) => user.id !== userId))
    } catch (err: any) {
      setError(err.message || 'Failed to update approval status')
    } finally {
      setProcessing(null)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">User Approvals</h1>
        </div>
        <p className="text-muted-foreground">
          Review and approve Owner and Manager role requests
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-md">
          {error}
        </div>
      )}

      {pendingUsers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <User className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg text-muted-foreground">
              No pending approval requests
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              All Owner and Manager accounts are approved.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingUsers.map((user) => (
            <Card key={user.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-5 h-5" />
                      {user.name || 'No name provided'}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {user.email} • {user.role}
                    </CardDescription>
                    <p className="text-xs text-muted-foreground mt-2">
                      Requested: {new Date(user.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleApproval(user.id, true)}
                      disabled={processing === user.id}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {processing === user.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Approve
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => handleApproval(user.id, false)}
                      disabled={processing === user.id}
                      variant="destructive"
                    >
                      {processing === user.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <X className="w-4 h-4 mr-2" />
                          Deny
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
