'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRoleView } from '@/contexts/RoleViewContext'
import { BookOpen, Plus, Upload, Users, Clock, CheckCircle2, X, FileText, Video, Link as LinkIcon, Search, Filter, Loader2, Edit, Trash2, ExternalLink, ChevronRight } from 'lucide-react'
import RichTextEditor from '@/components/training/RichTextEditor'
import TrainingContentViewer from '@/components/training/TrainingContentViewer'
import { format } from 'date-fns'

interface Course {
  id: string
  title: string
  description: string | null
  content: string | null
  category: string | null
  duration: number | null
  isActive: boolean
  createdBy: { id: string; name: string | null; email: string }
  materialsCount: number
  assignmentsCount: number
  createdAt: string
  updatedAt: string
}

interface Assignment {
  id: string
  employee: { id: string; name: string | null; email: string }
  course: { id: string; title: string; category: string | null; duration: number | null }
  progress: number
  status: string
  dueDate: string | null
  startedAt: string | null
  completedAt: string | null
}

interface Employee {
  id: string
  name: string | null
  email: string
}

interface Material {
  id: string
  title: string
  description: string | null
  fileUrl: string | null
  fileType: string | null
  order: number
  createdAt: string
  updatedAt: string
}

export default function TrainingPage() {
  const { data: session } = useSession()
  const { effectiveRole } = useRoleView()
  const [courses, setCourses] = useState<Course[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const [showCreateCourse, setShowCreateCourse] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null)
  const [newCourse, setNewCourse] = useState({ title: '', description: '', category: '', duration: '' })
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [dueDate, setDueDate] = useState('')
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)
  const [courseMaterials, setCourseMaterials] = useState<Material[]>([])
  const [showMaterialsModal, setShowMaterialsModal] = useState(false)
  const [showAddMaterialModal, setShowAddMaterialModal] = useState(false)
  const [newMaterial, setNewMaterial] = useState({ title: '', description: '', fileType: 'link', fileUrl: '', file: null as File | null })
  const [showEditContentModal, setShowEditContentModal] = useState(false)
  const [editingCourseContent, setEditingCourseContent] = useState<string>('')
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null)

  const canManage = effectiveRole === 'Owner' || effectiveRole === 'Super Admin' || effectiveRole === 'Manager'

  useEffect(() => {
    if (session?.user?.id) {
      loadCourses()
      loadAssignments()
      if (canManage) {
        loadEmployees()
      }
    }
  }, [session, canManage])

  const loadCourses = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/training/courses')
      if (response.ok) {
        const data = await response.json()
        setCourses(data.courses || [])
      }
    } catch (error) {
      console.error('Error loading courses:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAssignments = async () => {
    try {
      const response = await fetch('/api/training/assignments')
      if (response.ok) {
        const data = await response.json()
        setAssignments(data.assignments || [])
      }
    } catch (error) {
      console.error('Error loading assignments:', error)
    }
  }

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

  const loadCourseMaterials = async (courseId: string) => {
    try {
      const response = await fetch(`/api/training/materials?courseId=${courseId}`)
      if (response.ok) {
        const data = await response.json()
        setCourseMaterials(data.materials || [])
      }
    } catch (error) {
      console.error('Error loading course materials:', error)
    }
  }

  const handleOpenCourse = (courseId: string) => {
    setSelectedCourseId(courseId)
    setShowMaterialsModal(true)
    loadCourseMaterials(courseId)
  }

  const handleEditContent = (courseId: string) => {
    const course = courses.find(c => c.id === courseId)
    setEditingCourseId(courseId)
    setEditingCourseContent(course?.content || '')
    setShowEditContentModal(true)
  }

  const handleSaveContent = async () => {
    if (!editingCourseId) return

    setLoading(true)
    try {
      const response = await fetch(`/api/training/courses/${editingCourseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editingCourseContent }),
      })

      if (response.ok) {
        await loadCourses()
        setShowEditContentModal(false)
        setEditingCourseId(null)
        setEditingCourseContent('')
        setError('')
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to save content')
      }
    } catch (error) {
      console.error('Error saving content:', error)
      setError('Failed to save content')
    } finally {
      setLoading(false)
    }
  }

  const handleImageUpload = async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('courseId', editingCourseId || selectedCourseId || '')

    const response = await fetch('/api/training/upload-image', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error('Failed to upload image')
    }

    const data = await response.json()
    return data.url
  }

  const handleWordDocumentUpload = async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch('/api/training/convert-word', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to convert Word document')
    }

    const data = await response.json()
    return data.html
  }

  const handleAddMaterial = async () => {
    if (!selectedCourseId || !newMaterial.title.trim()) {
      setError('Title is required')
      return
    }

    if (newMaterial.fileType === 'link' && !newMaterial.fileUrl?.trim()) {
      setError('URL is required for link materials')
      return
    }

    if (newMaterial.fileType !== 'link' && !newMaterial.file) {
      setError('File is required')
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('courseId', selectedCourseId)
      formData.append('title', newMaterial.title)
      formData.append('description', newMaterial.description || '')
      formData.append('fileType', newMaterial.fileType)
      if (newMaterial.fileType === 'link') {
        formData.append('fileUrl', newMaterial.fileUrl || '')
      }
      if (newMaterial.file) {
        formData.append('file', newMaterial.file)
      }

      const response = await fetch('/api/training/materials', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        await loadCourseMaterials(selectedCourseId)
        await loadCourses() // Refresh course list to update materials count
        setNewMaterial({ title: '', description: '', fileType: 'link', fileUrl: '', file: null })
        setShowAddMaterialModal(false)
        setError('')
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to add material')
      }
    } catch (error) {
      console.error('Error adding material:', error)
      setError('Failed to add material')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCourse = async () => {
    if (!newCourse.title.trim()) {
      setError('Course title is required')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/training/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCourse),
      })

      if (response.ok) {
        const data = await response.json()
        await loadCourses() // Reload to get updated counts
        setNewCourse({ title: '', description: '', category: '', duration: '' })
        setShowCreateCourse(false)
        setError('')
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to create course')
      }
    } catch (error) {
      console.error('Error creating course:', error)
      setError('Failed to create course')
    } finally {
      setLoading(false)
    }
  }

  const handleAssignTraining = async () => {
    if (!selectedCourse || selectedEmployees.length === 0) {
      setError('Please select a course and at least one employee')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/training/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: selectedCourse,
          employeeIds: selectedEmployees,
          dueDate: dueDate || null,
        }),
      })

      if (response.ok) {
        await loadAssignments()
        setShowAssignModal(false)
        setSelectedCourse(null)
        setSelectedEmployees([])
        setDueDate('')
        setError('')
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to assign training')
      }
    } catch (error) {
      console.error('Error assigning training:', error)
      setError('Failed to assign training')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteMaterial = async (materialId: string) => {
    if (!confirm('Are you sure you want to delete this material?')) return

    setLoading(true)
    try {
      const response = await fetch(`/api/training/materials/${materialId}`, {
        method: 'DELETE',
      })

      if (response.ok && selectedCourseId) {
        await loadCourseMaterials(selectedCourseId)
        await loadCourses() // Refresh course list to update materials count
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to delete material')
      }
    } catch (error) {
      console.error('Error deleting material:', error)
      setError('Failed to delete material')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteCourse = async (courseId: string) => {
    if (!confirm('Are you sure you want to delete this course? This will also delete all materials and assignments.')) return

    setLoading(true)
    try {
      const response = await fetch(`/api/training/courses/${courseId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await loadCourses()
        if (selectedCourseId === courseId) {
          setShowMaterialsModal(false)
          setSelectedCourseId(null)
        }
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to delete course')
      }
    } catch (error) {
      console.error('Error deleting course:', error)
      setError('Failed to delete course')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleCourseActive = async (courseId: string, isActive: boolean) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/training/courses/${courseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      })

      if (response.ok) {
        await loadCourses()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to update course')
      }
    } catch (error) {
      console.error('Error updating course:', error)
      setError('Failed to update course')
    } finally {
      setLoading(false)
    }
  }

  const filteredCourses = courses.filter(course => {
    const matchesSearch = course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.description?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || course.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  const uniqueCategories = Array.from(new Set(courses.map(c => c.category).filter(Boolean))) as string[]

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Please sign in to access Training</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Training Program</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Upload training materials and assign courses to employees
            </p>
          </div>
          {canManage && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowAssignModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
              >
                <Users className="w-5 h-5" />
                Assign Training
              </button>
              <button
                onClick={() => setShowCreateCourse(true)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                New Course
              </button>
            </div>
          )}
        </div>

        {/* Create Course Modal */}
        {showCreateCourse && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create New Course</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Course Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newCourse.title}
                    onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                    placeholder="e.g., Safety Training, Equipment Operation"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={newCourse.description}
                    onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                    placeholder="Course description and objectives..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Category
                    </label>
                    <input
                      type="text"
                      value={newCourse.category}
                      onChange={(e) => setNewCourse({ ...newCourse, category: e.target.value })}
                      placeholder="e.g., Safety, Technical, Compliance"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Duration (minutes)
                    </label>
                    <input
                      type="number"
                      value={newCourse.duration}
                      onChange={(e) => setNewCourse({ ...newCourse, duration: e.target.value })}
                      placeholder="e.g., 60"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateCourse}
                    disabled={loading || !newCourse.title.trim()}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Creating...' : 'Create Course'}
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateCourse(false)
                      setNewCourse({ title: '', description: '', category: '', duration: '' })
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

        {/* Assign Training Modal */}
        {showAssignModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Assign Training</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Select Course <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedCourse || ''}
                    onChange={(e) => setSelectedCourse(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  >
                    <option value="">Choose a course...</option>
                    {courses.filter(c => c.isActive).map(course => (
                      <option key={course.id} value={course.id}>
                        {course.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Select Employees <span className="text-red-500">*</span>
                  </label>
                  <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-3 max-h-48 overflow-y-auto">
                    {employees.map(employee => (
                      <label key={employee.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedEmployees.includes(employee.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedEmployees([...selectedEmployees, employee.id])
                            } else {
                              setSelectedEmployees(selectedEmployees.filter(id => id !== employee.id))
                            }
                          }}
                          className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                        />
                        <span className="text-sm text-gray-900 dark:text-white">
                          {employee.name || employee.email}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Due Date (optional)
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAssignTraining}
                    disabled={loading || !selectedCourse || selectedEmployees.length === 0}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Assigning...' : 'Assign Training'}
                  </button>
                  <button
                    onClick={() => {
                      setShowAssignModal(false)
                      setSelectedCourse(null)
                      setSelectedEmployees([])
                      setDueDate('')
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

        {/* Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search courses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            />
          </div>
          {uniqueCategories.length > 0 && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            >
              <option value="all">All Categories</option>
              {uniqueCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          )}
        </div>

        {/* Courses Grid */}
        {loading && courses.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-red-600" />
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
            <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No training courses found</p>
            {canManage && (
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                Create your first course to get started
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {filteredCourses.map((course) => (
              <div
                key={course.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-gray-900 dark:text-white">{course.title}</h4>
                      {!course.isActive && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                          Hidden
                        </span>
                      )}
                    </div>
                    {course.category && (
                      <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                        {course.category}
                      </span>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleCourseActive(course.id, course.isActive)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          course.isActive
                            ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                            : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                        title={course.isActive ? 'Hide course' : 'Show course'}
                      >
                        {course.isActive ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : (
                          <X className="w-5 h-5" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteCourse(course.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Delete course"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                  {!canManage && (
                    course.isActive ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                    ) : (
                      <X className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    )
                  )}
                </div>
                {course.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                    {course.description}
                  </p>
                )}
                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500 mb-4">
                  {course.duration && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {course.duration} min
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    {course.materialsCount} materials
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {course.assignmentsCount} assigned
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenCourse(course.id)}
                    className="flex-1 px-3 py-2 text-sm bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-1"
                  >
                    <FileText className="w-4 h-4" />
                    View Content
                  </button>
                  {canManage && (
                    <button
                      onClick={() => {
                        setSelectedCourse(course.id)
                        setShowAssignModal(true)
                      }}
                      className="flex-1 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                    >
                      Assign
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Course Materials Modal */}
        {showMaterialsModal && selectedCourseId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {courses.find(c => c.id === selectedCourseId)?.title || 'Course Materials'}
                </h3>
                <div className="flex gap-2">
                  {canManage && (
                    <button
                      onClick={() => handleEditContent(selectedCourseId)}
                      className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Edit className="w-4 h-4" />
                      Edit Content
                    </button>
                  )}
                  <button
                    onClick={() => setShowAddMaterialModal(true)}
                    className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Add Material
                  </button>
                  <button
                    onClick={() => {
                      setShowMaterialsModal(false)
                      setSelectedCourseId(null)
                      setCourseMaterials([])
                    }}
                    className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Training Content */}
              {selectedCourseId && (
                <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
                  <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-3">Training Content</h4>
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                    <TrainingContentViewer content={courses.find(c => c.id === selectedCourseId)?.content || null} />
                  </div>
                </div>
              )}

              {courseMaterials.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">No materials added yet</p>
                  <button
                    onClick={() => setShowAddMaterialModal(true)}
                    className="mt-4 px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Add First Material
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {courseMaterials.map((material) => (
                    <div
                      key={material.id}
                      className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
                    >
                      <div className="flex-shrink-0 mt-1">
                        {material.fileType === 'video' ? (
                          <Video className="w-5 h-5 text-red-600" />
                        ) : material.fileType === 'link' ? (
                          <LinkIcon className="w-5 h-5 text-blue-600" />
                        ) : (
                          <FileText className="w-5 h-5 text-gray-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 dark:text-white mb-1">{material.title}</h4>
                        {material.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{material.description}</p>
                        )}
                        {material.fileUrl && (
                          <a
                            href={material.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            {material.fileType === 'link' ? 'Open Link' : 'View File'}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteMaterial(material.id)}
                        className="flex-shrink-0 p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Delete material"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Add Material Modal */}
        {showAddMaterialModal && selectedCourseId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add Course Material</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Material Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newMaterial.fileType}
                    onChange={(e) => setNewMaterial({ ...newMaterial, fileType: e.target.value, fileUrl: '', file: null })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  >
                    <option value="link">Link/URL</option>
                    <option value="pdf">PDF Document</option>
                    <option value="document">Document</option>
                    <option value="video">Video</option>
                    <option value="image">Image</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newMaterial.title}
                    onChange={(e) => setNewMaterial({ ...newMaterial, title: e.target.value })}
                    placeholder="e.g., Safety Manual, Training Video"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={newMaterial.description}
                    onChange={(e) => setNewMaterial({ ...newMaterial, description: e.target.value })}
                    placeholder="Brief description of the material..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
                {newMaterial.fileType === 'link' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      URL <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="url"
                      value={newMaterial.fileUrl}
                      onChange={(e) => setNewMaterial({ ...newMaterial, fileUrl: e.target.value })}
                      placeholder="https://example.com"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      File <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="file"
                      onChange={(e) => setNewMaterial({ ...newMaterial, file: e.target.files?.[0] || null })}
                      accept={
                        newMaterial.fileType === 'pdf' ? '.pdf' :
                        newMaterial.fileType === 'video' ? 'video/*' :
                        newMaterial.fileType === 'image' ? 'image/*' :
                        '.doc,.docx,.txt,.pdf'
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    />
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleAddMaterial}
                    disabled={loading || !newMaterial.title.trim()}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Adding...' : 'Add Material'}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddMaterialModal(false)
                      setNewMaterial({ title: '', description: '', fileType: 'link', fileUrl: '', file: null })
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

        {/* Edit Content Modal */}
        {showEditContentModal && editingCourseId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Edit Training Content - {courses.find(c => c.id === editingCourseId)?.title}
                </h3>
                <button
                  onClick={() => {
                    setShowEditContentModal(false)
                    setEditingCourseId(null)
                    setEditingCourseContent('')
                    setError('')
                  }}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Close
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Training Content
                  </label>
                  <RichTextEditor
                    content={editingCourseContent}
                    onChange={setEditingCourseContent}
                    placeholder="Write your training content here. You can format text, add images, and create structured content."
                    onImageUpload={handleImageUpload}
                    onWordDocumentUpload={handleWordDocumentUpload}
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleSaveContent}
                    disabled={loading}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Saving...' : 'Save Content'}
                  </button>
                  <button
                    onClick={() => {
                      setShowEditContentModal(false)
                      setEditingCourseId(null)
                      setEditingCourseContent('')
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

        {/* My Assignments Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">My Training Assignments</h3>
          {assignments.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-center py-4">No training assignments</p>
          ) : (
            <div className="space-y-3">
              {assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white">{assignment.course.title}</p>
                    {assignment.dueDate && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Due: {format(new Date(assignment.dueDate), 'MMM dd, yyyy')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {assignment.progress}%
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500 capitalize">
                        {assignment.status.replace('_', ' ')}
                      </div>
                    </div>
                    <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-600 transition-all"
                        style={{ width: `${assignment.progress}%` }}
                      />
                    </div>
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
