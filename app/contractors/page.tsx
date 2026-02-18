'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRoleView } from '@/contexts/RoleViewContext'
import { Building2, Phone, Mail, MapPin, Wrench, Plus, Edit, Search, Trash2, Loader2 } from 'lucide-react'
import { ScopeFilters, buildScopeQueryParams, defaultScopeFiltersValues, type ScopeFiltersValues } from '@/components/ScopeFilters'
import { format } from 'date-fns'

const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
  { value: 'DC', label: 'District of Columbia' },
]

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
  notes: string | null
  createdBy: {
    id: string
    name: string | null
    email: string
  }
  createdAt: string
  updatedAt: string
}

export default function ContractorsPage() {
  const { data: session } = useSession()
  const { effectiveRole } = useRoleView()
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [loading, setLoading] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedContractor, setSelectedContractor] = useState<Contractor | null>(null)
  const [contractorForm, setContractorForm] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    city: '',
    state: '',
    zipcode: '',
    company: '',
    specialty: '',
    notes: '',
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSpecialty, setFilterSpecialty] = useState<string>('all')
  const [error, setError] = useState('')
  const [scopeFilters, setScopeFilters] = useState<ScopeFiltersValues>(defaultScopeFiltersValues)

  const loadContractors = useCallback(async () => {
    setLoading(true)
    try {
      const query = buildScopeQueryParams(scopeFilters)
      const url = query ? `/api/contractors?${query}` : '/api/contractors'
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setContractors(data.contractors || [])
      }
    } catch (error) {
      console.error('Error loading contractors:', error)
    } finally {
      setLoading(false)
    }
  }, [scopeFilters])

  useEffect(() => {
    if (session?.user?.id) {
      loadContractors()
    }
  }, [session, loadContractors])

  const handleSaveContractor = async () => {
    if (!contractorForm.name.trim()) {
      setError('Contractor name is required')
      return
    }

    setLoading(true)
    try {
      const url = selectedContractor ? `/api/contractors/${selectedContractor.id}` : '/api/contractors'
      const method = selectedContractor ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contractorForm),
      })

      if (response.ok) {
        await loadContractors()
        setShowEditModal(false)
        setSelectedContractor(null)
        setContractorForm({
          name: '',
          email: '',
          phoneNumber: '',
          city: '',
          state: '',
          zipcode: '',
          company: '',
          specialty: '',
          notes: '',
        })
        setError('')
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to save contractor')
      }
    } catch (error) {
      console.error('Error saving contractor:', error)
      setError('Failed to save contractor')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this contractor?')) {
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/contractors/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await loadContractors()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to delete contractor')
      }
    } catch (error) {
      console.error('Error deleting contractor:', error)
      alert('Failed to delete contractor')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (contractor: Contractor) => {
    setSelectedContractor(contractor)
    setContractorForm({
      name: contractor.name,
      email: contractor.email || '',
      phoneNumber: contractor.phoneNumber || '',
      city: contractor.city || '',
      state: contractor.state || '',
      zipcode: contractor.zipcode || '',
      company: contractor.company || '',
      specialty: contractor.specialty || '',
      notes: contractor.notes || '',
    })
    setShowEditModal(true)
  }

  const filteredContractors = contractors.filter(contractor => {
    const searchLower = searchTerm.toLowerCase()
    const matchesSearch =
      contractor.name.toLowerCase().includes(searchLower) ||
      contractor.email?.toLowerCase().includes(searchLower) ||
      contractor.company?.toLowerCase().includes(searchLower) ||
      contractor.specialty?.toLowerCase().includes(searchLower) ||
      contractor.city?.toLowerCase().includes(searchLower) ||
      contractor.state?.toLowerCase().includes(searchLower) ||
      contractor.zipcode?.toLowerCase().includes(searchLower) ||
      contractor.phoneNumber?.toLowerCase().includes(searchLower)
    const matchesSpecialty = filterSpecialty === 'all' || contractor.specialty === filterSpecialty
    return matchesSearch && matchesSpecialty
  })

  const uniqueSpecialties = Array.from(
    new Set(contractors.map(c => c.specialty).filter(Boolean))
  ) as string[]

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Please sign in to access Contractor Directory</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Contractor Directory</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Shared directory of contractors and service providers
            </p>
          </div>
          <button
            onClick={() => {
              setSelectedContractor(null)
              setContractorForm({
                name: '',
                email: '',
                phoneNumber: '',
                city: '',
          state: '',
          zipcode: '',
                company: '',
                specialty: '',
                notes: '',
              })
              setShowEditModal(true)
            }}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Contractor
          </button>
        </div>

        {/* Edit/Add Contractor Modal */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {selectedContractor ? 'Edit Contractor' : 'Add New Contractor'}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Contractor Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={contractorForm.name}
                    onChange={(e) => setContractorForm({ ...contractorForm, name: e.target.value })}
                    placeholder="e.g., John Smith"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Company (optional)
                    </label>
                    <input
                      type="text"
                      value={contractorForm.company}
                      onChange={(e) => setContractorForm({ ...contractorForm, company: e.target.value })}
                      placeholder="Company name"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Specialty
                    </label>
                    <input
                      type="text"
                      value={contractorForm.specialty}
                      onChange={(e) => setContractorForm({ ...contractorForm, specialty: e.target.value })}
                      placeholder="e.g., Plumbing, Electrical, Roofing"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Location
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={contractorForm.city}
                      onChange={(e) => setContractorForm({ ...contractorForm, city: e.target.value })}
                      placeholder="City"
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    />
                    <select
                      value={contractorForm.state}
                      onChange={(e) => setContractorForm({ ...contractorForm, state: e.target.value })}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    >
                      <option value="">State</option>
                      {US_STATES.map((state) => (
                        <option key={state.value} value={state.value}>
                          {state.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={contractorForm.zipcode}
                      onChange={(e) => setContractorForm({ ...contractorForm, zipcode: e.target.value })}
                      placeholder="Zipcode"
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={contractorForm.phoneNumber}
                      onChange={(e) => setContractorForm({ ...contractorForm, phoneNumber: e.target.value })}
                      placeholder="e.g., (555) 123-4567"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={contractorForm.email}
                      onChange={(e) => setContractorForm({ ...contractorForm, email: e.target.value })}
                      placeholder="email@example.com"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Notes (optional)
                  </label>
                  <textarea
                    value={contractorForm.notes}
                    onChange={(e) => setContractorForm({ ...contractorForm, notes: e.target.value })}
                    placeholder="Additional information, ratings, or notes..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveContractor}
                    disabled={loading || !contractorForm.name.trim()}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Saving...' : 'Save Contractor'}
                  </button>
                  <button
                    onClick={() => {
                      setShowEditModal(false)
                      setSelectedContractor(null)
                      setContractorForm({
                        name: '',
                        email: '',
                        phoneNumber: '',
                        city: '',
          state: '',
          zipcode: '',
                        company: '',
                        specialty: '',
                        notes: '',
                      })
                      setError('')
                    }}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
                {error && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm">
                    {error}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Scope filters (Manager / Owner / Super Admin) */}
        <div className="mb-4">
          <ScopeFilters
            effectiveRole={effectiveRole}
            values={scopeFilters}
            onChange={setScopeFilters}
          />
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search contractors by name, company, specialty, city, state, zipcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            />
          </div>
          {uniqueSpecialties.length > 0 && (
            <select
              value={filterSpecialty}
              onChange={(e) => setFilterSpecialty(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            >
              <option value="all">All Specialties</option>
              {uniqueSpecialties.map(specialty => (
                <option key={specialty} value={specialty}>{specialty}</option>
              ))}
            </select>
          )}
        </div>

        {/* Contractors Grid */}
        {loading && contractors.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-red-600" />
          </div>
        ) : filteredContractors.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
            <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No contractors found</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
              Add contractors to build your directory
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredContractors.map((contractor) => (
              <div
                key={contractor.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                      {contractor.name}
                    </h4>
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
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEdit(contractor)}
                      className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(contractor.id)}
                      className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {(contractor.city || contractor.state || contractor.zipcode) && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <MapPin className="w-4 h-4" />
                      {[contractor.city, contractor.state, contractor.zipcode].filter(Boolean).join(', ')}
                    </div>
                  )}
                  {contractor.phoneNumber && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Phone className="w-4 h-4" />
                      {contractor.phoneNumber}
                    </div>
                  )}
                  {contractor.email && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Mail className="w-4 h-4" />
                      {contractor.email}
                    </div>
                  )}
                  {contractor.notes && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                        {contractor.notes}
                      </p>
                    </div>
                  )}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        Added by
                      </p>
                      <p className="text-sm text-gray-900 dark:text-white font-semibold">
                        {contractor.createdBy.name || contractor.createdBy.email}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      {format(new Date(contractor.createdAt), 'MMM dd, yyyy')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
