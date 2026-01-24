'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Phone, Mail, MapPin, Plus, Edit, User, Calendar, Briefcase, Award, FileText, Settings, Save, X } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'

interface ProfileData {
  name: string | null
  email: string
  bio: string | null
  createdAt: string
  role: string | null
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

interface ProfileStats {
  contractorsAdded: number
  submissionsCount: number
  trainingCompleted: number
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
  const [stats, setStats] = useState<ProfileStats>({
    contractorsAdded: 0,
    submissionsCount: 0,
    trainingCompleted: 0,
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (session) {
      fetchProfile()
      fetchMyContractors()
      fetchStats()
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
        setStats(prev => ({ ...prev, contractorsAdded: data.contractors?.length || 0 }))
      }
    } catch (error) {
      console.error('Error fetching my contractors:', error)
    } finally {
      setContractorsLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      // Fetch additional stats if needed
      // For now, we'll use contractors count from above
    } catch (error) {
      console.error('Error fetching stats:', error)
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

  if (!session || !profile) {
    return null
  }

  const getRoleBadgeColor = (role: string | null) => {
    switch (role) {
      case 'Super Admin':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
      case 'Owner':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
      case 'Manager':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
      case 'Employee':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section with Profile Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-8">
          {/* Header Background */}
          <div className="h-32 bg-gradient-to-r from-red-600 via-red-700 to-red-800 dark:from-red-800 dark:via-red-900 dark:to-red-950"></div>
          
          {/* Profile Content */}
          <div className="px-8 pb-8 -mt-16">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-6">
              {/* Avatar */}
              <div className="relative">
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-red-500 to-red-700 dark:from-red-600 dark:to-red-800 flex items-center justify-center text-white text-4xl font-bold shadow-lg border-4 border-white dark:border-gray-800">
                  {profile.name ? profile.name.charAt(0).toUpperCase() : profile.email.charAt(0).toUpperCase()}
                </div>
                {editing && (
                  <button
                    onClick={() => setEditing(false)}
                    className="absolute -bottom-2 -right-2 p-2 bg-white dark:bg-gray-700 rounded-full shadow-lg border-2 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                    title="Cancel editing"
                  >
                    <X className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                  </button>
                )}
              </div>

              {/* Profile Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                        {profile.name || 'User'}
                      </h1>
                      {session.user?.role && (
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getRoleBadgeColor(session.user.role)}`}>
                          {session.user.role}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <Mail className="w-4 h-4" />
                      <span>{profile.email}</span>
                    </div>
                  </div>
                  {!editing && (
                    <button
                      onClick={() => setEditing(true)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2 shadow-md"
                    >
                      <Edit className="w-4 h-4" />
                      Edit Profile
                    </button>
                  )}
                </div>

                {/* Bio Section */}
                {editing ? (
                  <div className="space-y-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6 border border-gray-200 dark:border-gray-600">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Name
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 dark:bg-gray-800 dark:text-white"
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Bio
                      </label>
                      <textarea
                        value={formData.bio}
                        onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                        rows={4}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 dark:bg-gray-800 dark:text-white"
                        placeholder="Tell us about yourself..."
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSave}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
                      >
                        <Save className="w-4 h-4" />
                        Save Changes
                      </button>
                      <button
                        onClick={() => {
                          setEditing(false)
                          setFormData({ name: profile.name || '', bio: profile.bio || '' })
                        }}
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6 border border-gray-200 dark:border-gray-600">
                    {profile.bio ? (
                      <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{profile.bio}</p>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 italic">No bio set. Click "Edit Profile" to add one.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Contractors Added</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.contractorsAdded}</p>
              </div>
              <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <Building2 className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Member Since</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {profile.createdAt ? format(new Date(profile.createdAt), 'MMM yyyy') : 'N/A'}
                </p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Role</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
                  {session.user?.role || 'User'}
                </p>
              </div>
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Award className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>
        </div>

        {/* My Contractors Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                My Contractors
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Contractors you've added to the directory
              </p>
            </div>
            <Link
              href="/contractors"
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2 shadow-md"
            >
              <Plus className="w-4 h-4" />
              Add Contractor
            </Link>
          </div>

          {contractorsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : myContractors.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No contractors yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Start building your contractor directory by adding your first contractor
              </p>
              <Link
                href="/contractors"
                className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors shadow-md"
              >
                <Plus className="w-5 h-5" />
                Add Your First Contractor
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myContractors.map((contractor) => (
                <div
                  key={contractor.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-xl p-5 hover:shadow-lg transition-all hover:border-red-300 dark:hover:border-red-700/50 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 dark:text-white mb-1 truncate">
                        {contractor.name}
                      </h3>
                      {contractor.company && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
                          <Briefcase className="w-3 h-3" />
                          <span className="truncate">{contractor.company}</span>
                        </div>
                      )}
                      {contractor.specialty && (
                        <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                          {contractor.specialty}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {(contractor.city || contractor.state || contractor.zipcode) && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">
                          {[contractor.city, contractor.state, contractor.zipcode].filter(Boolean).join(', ')}
                        </span>
                      </div>
                    )}
                    {contractor.phoneNumber && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{contractor.phoneNumber}</span>
                      </div>
                    )}
                    {contractor.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{contractor.email}</span>
                      </div>
                    )}
                  </div>
                  <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      Added {format(new Date(contractor.createdAt), 'MMM dd, yyyy')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
