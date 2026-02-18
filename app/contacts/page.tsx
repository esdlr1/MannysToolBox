'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRoleView } from '@/contexts/RoleViewContext'
import { Users, Phone, Mail, MapPin, Briefcase, Plus, Edit, Search, Loader2 } from 'lucide-react'
import { ScopeFilters, buildScopeQueryParams, defaultScopeFiltersValues, type ScopeFiltersValues } from '@/components/ScopeFilters'

interface Contact {
  id: string
  userId: string
  user: {
    id: string
    name: string | null
    email: string
  }
  position: string | null
  workLocation: string | null
  phoneNumber: string | null
  email: string | null
}

interface Employee {
  id: string
  name: string | null
  email: string
}

export default function ContactsPage() {
  const { data: session } = useSession()
  const { effectiveRole } = useRoleView()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [contactForm, setContactForm] = useState({
    userId: '',
    position: '',
    workLocation: '',
    phoneNumber: '',
    email: '',
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [error, setError] = useState('')
  const [scopeFilters, setScopeFilters] = useState<ScopeFiltersValues>(defaultScopeFiltersValues)

  const canManage = effectiveRole === 'Owner' || effectiveRole === 'Super Admin' || effectiveRole === 'Manager'

  const loadContacts = useCallback(async () => {
    setLoading(true)
    try {
      const query = buildScopeQueryParams(scopeFilters)
      const url = query ? `/api/contacts?${query}` : '/api/contacts'
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setContacts(data.contacts || [])
      }
    } catch (error) {
      console.error('Error loading contacts:', error)
    } finally {
      setLoading(false)
    }
  }, [scopeFilters])

  useEffect(() => {
    if (session?.user?.id) {
      loadContacts()
    }
  }, [session, loadContacts])

  useEffect(() => {
    if (session?.user?.id && canManage) {
      loadEmployees()
    }
  }, [session, canManage])

  const loadEmployees = async () => {
    try {
      const response = await fetch('/api/daily-notepad/employees')
      if (response.ok) {
        const data = await response.json()
        setEmployees(data.employees || [])
      }
    } catch (error) {
      console.error('Error loading employees:', error)
    }
  }

  const handleSaveContact = async () => {
    if (!contactForm.userId) {
      setError('Please select an employee')
      return
    }

    setLoading(true)
    try {
      const url = selectedContact ? `/api/contacts/${selectedContact.id}` : '/api/contacts'
      const method = selectedContact ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm),
      })

      if (response.ok) {
        await loadContacts()
        setShowEditModal(false)
        setSelectedContact(null)
        setContactForm({ userId: '', position: '', workLocation: '', phoneNumber: '', email: '' })
        setError('')
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to save contact')
      }
    } catch (error) {
      console.error('Error saving contact:', error)
      setError('Failed to save contact')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (contact: Contact) => {
    setSelectedContact(contact)
    setContactForm({
      userId: contact.userId,
      position: contact.position || '',
      workLocation: contact.workLocation || '',
      phoneNumber: contact.phoneNumber || '',
      email: contact.email || '',
    })
    setShowEditModal(true)
  }

  const filteredContacts = contacts.filter(contact => {
    const searchLower = searchTerm.toLowerCase()
    return (
      contact.user.name?.toLowerCase().includes(searchLower) ||
      contact.user.email.toLowerCase().includes(searchLower) ||
      contact.position?.toLowerCase().includes(searchLower) ||
      contact.workLocation?.toLowerCase().includes(searchLower) ||
      contact.phoneNumber?.toLowerCase().includes(searchLower)
    )
  })

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Please sign in to access Contacts</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Employee Contacts</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage employee contact information and directories
            </p>
          </div>
          {canManage && (
            <button
              onClick={() => {
                setSelectedContact(null)
                setContactForm({ userId: '', position: '', workLocation: '', phoneNumber: '', email: '' })
                setShowEditModal(true)
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Contact
            </button>
          )}
        </div>

        {/* Edit/Add Contact Modal */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {selectedContact ? 'Edit Contact' : 'Add New Contact'}
              </h3>
              <div className="space-y-4">
                {!selectedContact && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Employee <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={contactForm.userId}
                      onChange={(e) => setContactForm({ ...contactForm, userId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    >
                      <option value="">Choose an employee...</option>
                      {employees.map(employee => (
                        <option key={employee.id} value={employee.id}>
                          {employee.name || employee.email}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Position
                  </label>
                  <input
                    type="text"
                    value={contactForm.position}
                    onChange={(e) => setContactForm({ ...contactForm, position: e.target.value })}
                    placeholder="e.g., Project Manager, Estimator"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Work Location
                  </label>
                  <input
                    type="text"
                    value={contactForm.workLocation}
                    onChange={(e) => setContactForm({ ...contactForm, workLocation: e.target.value })}
                    placeholder="e.g., Main Office, Field Location"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={contactForm.phoneNumber}
                    onChange={(e) => setContactForm({ ...contactForm, phoneNumber: e.target.value })}
                    placeholder="e.g., (555) 123-4567"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email (optional - defaults to account email)
                  </label>
                  <input
                    type="email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    placeholder="contact@example.com"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveContact}
                    disabled={loading || (!selectedContact && !contactForm.userId)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Saving...' : 'Save Contact'}
                  </button>
                  <button
                    onClick={() => {
                      setShowEditModal(false)
                      setSelectedContact(null)
                      setContactForm({ userId: '', position: '', workLocation: '', phoneNumber: '', email: '' })
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

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search contacts by name, email, position, or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Contacts Grid */}
        {loading && contacts.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-red-600" />
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No contacts found</p>
            {canManage && (
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                Add employee contacts to get started
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredContacts.map((contact) => (
              <div
                key={contact.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                      {contact.user.name || contact.user.email}
                    </h4>
                    {contact.position && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
                        <Briefcase className="w-4 h-4" />
                        {contact.position}
                      </div>
                    )}
                  </div>
                  {canManage && (
                    <button
                      onClick={() => handleEdit(contact)}
                      className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {contact.workLocation && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <MapPin className="w-4 h-4" />
                      {contact.workLocation}
                    </div>
                  )}
                  {contact.phoneNumber && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Phone className="w-4 h-4" />
                      {contact.phoneNumber}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Mail className="w-4 h-4" />
                    {contact.email || contact.user.email}
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
