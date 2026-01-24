'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Phone, Mail, MapPin, Plus } from 'lucide-react'
import Link from 'next/link'

interface ProfileData {
  name: string | null
  email: string
  bio: string | null
  createdAt: string
}

interface Contractor {
  id: string
  name: string
  email: string | null
  phoneNumber: string | null
  city: string | null
  state: string | null
  zipcode: string | null
  company: string | null
  specialty: string | null
  createdAt: string
}

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState({ name: '', bio: '' })
  const [myContractors, setMyContractors] = useState<Contractor[]>([])
  const [contractorsLoading, setContractorsLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (session) {
      fetchProfile()
      fetchMyContractors()
    }
  }, [session, status, router])

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/profile')
      if (response.ok) {
        const data = await response.json()
        setProfile(data)
        setFormData({ name: data.name || '', bio: data.bio || '' })
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMyContractors = async () => {
    setContractorsLoading(true)
    try {
      const response = await fetch('/api/contractors/my-contractors')
      if (response.ok) {
        const data = await response.json()
        setMyContractors(data.contractors || [])
      }
    } catch (error) {
      console.error('Error fetching my contractors:', error)
    } finally {
      setContractorsLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        await fetchProfile()
        setEditing(false)
      }
    } catch (error) {
      console.error('Error updating profile:', error)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">
        <span className="text-red-600 dark:text-red-400">Profile</span>
      </h1>

      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8">
        {editing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Bio
              </label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditing(false)
                  setFormData({ name: profile?.name || '', bio: profile?.bio || '' })
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Email
              </label>
              <p className="text-gray-900 dark:text-white">{profile?.email || session.user?.email}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Name
              </label>
              <p className="text-gray-900 dark:text-white">{profile?.name || 'Not set'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Bio
              </label>
              <p className="text-gray-900 dark:text-white">{profile?.bio || 'No bio set'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Member Since
              </label>
              <p className="text-gray-900 dark:text-white">
                {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'N/A'}
              </p>
            </div>
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              Edit Profile
            </button>
          </div>
        )}
      </div>

      {/* My Contractors Section */}
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8 mt-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            My Contractors
          </h2>
          <Link
            href="/contractors"
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Contractor
          </Link>
        </div>

        {contractorsLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : myContractors.length === 0 ? (
          <div className="text-center py-8">
            <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              You haven't added any contractors yet
            </p>
            <Link
              href="/contractors"
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Your First Contractor
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myContractors.map((contractor) => (
              <div
                key={contractor.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                      {contractor.name}
                    </h3>
                    {contractor.company && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
                        <Building2 className="w-4 h-4" />
                        {contractor.company}
                      </div>
                    )}
                    {contractor.specialty && (
                      <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                        {contractor.specialty}
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                  {(contractor.city || contractor.state || contractor.zipcode) && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3 h-3" />
                      {[contractor.city, contractor.state, contractor.zipcode].filter(Boolean).join(', ')}
                    </div>
                  )}
                  {contractor.phoneNumber && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3 h-3" />
                      {contractor.phoneNumber}
                    </div>
                  )}
                  {contractor.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3 h-3" />
                      {contractor.email}
                    </div>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    Added {new Date(contractor.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
