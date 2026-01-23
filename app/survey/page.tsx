'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRoleView } from '@/contexts/RoleViewContext'
import { FileText, Plus, Send, BarChart3, Users, Calendar, Loader2, Search } from 'lucide-react'
import { format } from 'date-fns'

interface Survey {
  id: string
  title: string
  description: string | null
  createdBy: { id: string; name: string | null; email: string }
  targetType: string
  targetIds: string[]
  isActive: boolean
  deadline: string | null
  createdAt: string
  _count: { responses: number }
}

interface Question {
  id: string
  type: 'multiple_choice' | 'text' | 'rating' | 'yes_no'
  question: string
  options?: string[]
  required: boolean
}

export default function SurveyPage() {
  const { data: session } = useSession()
  const { effectiveRole } = useRoleView()
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [loading, setLoading] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newSurvey, setNewSurvey] = useState({
    title: '',
    description: '',
    targetType: 'all' as 'all' | 'team' | 'selected' | 'department',
    targetIds: [] as string[],
    deadline: '',
    questions: [] as Question[],
  })
  const [currentQuestion, setCurrentQuestion] = useState<Question>({
    id: Date.now().toString(),
    type: 'multiple_choice',
    question: '',
    options: [''],
    required: false,
  })
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  const canManage = effectiveRole === 'Owner' || effectiveRole === 'Super Admin' || effectiveRole === 'Manager'

  useEffect(() => {
    if (session?.user?.id) {
      loadSurveys()
    }
  }, [session])

  const loadSurveys = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/surveys')
      if (response.ok) {
        const data = await response.json()
        setSurveys(data.surveys || [])
      }
    } catch (error) {
      console.error('Error loading surveys:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddQuestion = () => {
    if (!currentQuestion.question.trim()) {
      setError('Question text is required')
      return
    }

    if (currentQuestion.type === 'multiple_choice' && (!currentQuestion.options || currentQuestion.options.length < 2)) {
      setError('Multiple choice questions need at least 2 options')
      return
    }

    setNewSurvey({
      ...newSurvey,
      questions: [...newSurvey.questions, { ...currentQuestion, id: Date.now().toString() }],
    })
    setCurrentQuestion({
      id: Date.now().toString(),
      type: 'multiple_choice',
      question: '',
      options: [''],
      required: false,
    })
    setError('')
  }

  const handleCreateSurvey = async () => {
    if (!newSurvey.title.trim()) {
      setError('Survey title is required')
      return
    }

    if (newSurvey.questions.length === 0) {
      setError('Please add at least one question')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/surveys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newSurvey,
          deadline: newSurvey.deadline || null,
        }),
      })

      if (response.ok) {
        await loadSurveys()
        setShowCreateModal(false)
        setNewSurvey({
          title: '',
          description: '',
          targetType: 'all',
          targetIds: [],
          deadline: '',
          questions: [],
        })
        setError('')
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to create survey')
      }
    } catch (error) {
      console.error('Error creating survey:', error)
      setError('Failed to create survey')
    } finally {
      setLoading(false)
    }
  }

  const filteredSurveys = surveys.filter(survey =>
    survey.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    survey.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Please sign in to access Surveys</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Surveys & Feedback</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Create surveys and collect feedback from your team
            </p>
          </div>
          {canManage && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Create Survey
            </button>
          )}
        </div>

        {/* Create Survey Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create New Survey</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Survey Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newSurvey.title}
                    onChange={(e) => setNewSurvey({ ...newSurvey, title: e.target.value })}
                    placeholder="e.g., Employee Satisfaction Survey"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={newSurvey.description}
                    onChange={(e) => setNewSurvey({ ...newSurvey, description: e.target.value })}
                    placeholder="Survey description and instructions..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Target Audience
                    </label>
                    <select
                      value={newSurvey.targetType}
                      onChange={(e) => setNewSurvey({ ...newSurvey, targetType: e.target.value as any, targetIds: [] })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    >
                      <option value="all">All Employees</option>
                      <option value="team">Specific Team</option>
                      <option value="selected">Selected Members</option>
                      <option value="department">Department</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Deadline (optional)
                    </label>
                    <input
                      type="date"
                      value={newSurvey.deadline}
                      onChange={(e) => setNewSurvey({ ...newSurvey, deadline: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Questions Section */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Questions</h4>
                  
                  {/* Add Question Form */}
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg mb-4">
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Question Type
                        </label>
                        <select
                          value={currentQuestion.type}
                          onChange={(e) => {
                            const newType = e.target.value as Question['type']
                            setCurrentQuestion({
                              ...currentQuestion,
                              type: newType,
                              options: newType === 'multiple_choice' ? [''] : undefined,
                            })
                          }}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                        >
                          <option value="multiple_choice">Multiple Choice</option>
                          <option value="text">Text Response</option>
                          <option value="rating">Rating Scale (1-5)</option>
                          <option value="yes_no">Yes/No</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Question <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={currentQuestion.question}
                          onChange={(e) => setCurrentQuestion({ ...currentQuestion, question: e.target.value })}
                          placeholder="Enter your question..."
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                        />
                      </div>
                      {currentQuestion.type === 'multiple_choice' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Options
                          </label>
                          {currentQuestion.options?.map((option, idx) => (
                            <div key={idx} className="flex gap-2 mb-2">
                              <input
                                type="text"
                                value={option}
                                onChange={(e) => {
                                  const newOptions = [...(currentQuestion.options || [])]
                                  newOptions[idx] = e.target.value
                                  setCurrentQuestion({ ...currentQuestion, options: newOptions })
                                }}
                                placeholder={`Option ${idx + 1}`}
                                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                              />
                              {currentQuestion.options && currentQuestion.options.length > 1 && (
                                <button
                                  onClick={() => {
                                    const newOptions = currentQuestion.options?.filter((_, i) => i !== idx) || ['']
                                    setCurrentQuestion({ ...currentQuestion, options: newOptions })
                                  }}
                                  className="px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          ))}
                          <button
                            onClick={() => {
                              setCurrentQuestion({
                                ...currentQuestion,
                                options: [...(currentQuestion.options || []), ''],
                              })
                            }}
                            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                          >
                            + Add Option
                          </button>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={currentQuestion.required}
                          onChange={(e) => setCurrentQuestion({ ...currentQuestion, required: e.target.checked })}
                          className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                        />
                        <label className="text-sm text-gray-700 dark:text-gray-300">Required question</label>
                      </div>
                      <button
                        onClick={handleAddQuestion}
                        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                      >
                        Add Question
                      </button>
                    </div>
                  </div>

                  {/* Added Questions List */}
                  {newSurvey.questions.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {newSurvey.questions.map((q, idx) => (
                        <div key={q.id} className="flex items-start justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {idx + 1}. {q.question}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 capitalize mt-1">
                              {q.type.replace('_', ' ')} {q.required && '• Required'}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setNewSurvey({
                                ...newSurvey,
                                questions: newSurvey.questions.filter((_, i) => i !== idx),
                              })
                            }}
                            className="text-red-600 hover:text-red-700 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={handleCreateSurvey}
                    disabled={loading || !newSurvey.title.trim() || newSurvey.questions.length === 0}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Creating...' : 'Create & Send Survey'}
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateModal(false)
                      setNewSurvey({
                        title: '',
                        description: '',
                        targetType: 'all',
                        targetIds: [],
                        deadline: '',
                        questions: [],
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

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search surveys..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Surveys List */}
        {loading && surveys.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-red-600" />
          </div>
        ) : filteredSurveys.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No surveys found</p>
            {canManage && (
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                Create your first survey to get started
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSurveys.map((survey) => (
              <div
                key={survey.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">{survey.title}</h4>
                    {survey.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                        {survey.description}
                      </p>
                    )}
                  </div>
                  {survey.isActive ? (
                    <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                      Inactive
                    </span>
                  )}
                </div>
                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    {survey.targetType === 'all' ? 'All Employees' : `${survey.targetIds.length} selected`}
                  </div>
                  {survey.deadline && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Due: {format(new Date(survey.deadline), 'MMM dd, yyyy')}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    {survey._count.responses} responses
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    Created by {survey.createdBy.name || survey.createdBy.email}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    {format(new Date(survey.createdAt), 'MMM dd, yyyy')}
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
