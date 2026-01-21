'use client'

import { useState } from 'react'
import { X, CheckCircle2, XCircle, MessageSquare, Loader2 } from 'lucide-react'

interface FeedbackModalProps {
  isOpen: boolean
  onClose: () => void
  itemType: 'missing_item' | 'discrepancy' | 'overall'
  itemIndex?: number
  itemDescription?: string
  onFeedbackSubmitted?: () => void
}

export function FeedbackModal({
  isOpen,
  onClose,
  itemType,
  itemIndex,
  itemDescription,
  onFeedbackSubmitted,
}: FeedbackModalProps) {
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [feedbackType, setFeedbackType] = useState<string>('')
  const [comment, setComment] = useState('')
  const [adjusterData, setAdjusterData] = useState('')
  const [contractorData, setContractorData] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (isCorrect === null) {
      alert('Please indicate if this result is correct or incorrect')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/tools/estimate-comparison/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemType,
          itemIndex,
          itemDescription,
          isCorrect,
          feedbackType: feedbackType || null,
          comment: comment || null,
          adjusterData: adjusterData || null,
          contractorData: contractorData || null,
          metadata: {
            timestamp: new Date().toISOString(),
          },
        }),
      })

      if (response.ok) {
        setSubmitted(true)
        setTimeout(() => {
          onClose()
          if (onFeedbackSubmitted) onFeedbackSubmitted()
          // Reset form
          setIsCorrect(null)
          setFeedbackType('')
          setComment('')
          setAdjusterData('')
          setContractorData('')
          setSubmitted(false)
        }, 1500)
      } else {
        throw new Error('Failed to submit feedback')
      }
    } catch (error) {
      console.error('Feedback submission error:', error)
      alert('Failed to submit feedback. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Provide Feedback
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {itemDescription && (
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Item:
              </p>
              <p className="text-sm text-gray-900 dark:text-white">
                {itemDescription}
              </p>
            </div>
          )}

          {submitted ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                Thank you for your feedback!
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Your feedback helps us improve the tool.
              </p>
            </div>
          ) : (
            <>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Is this result correct?
                </p>
                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      setIsCorrect(true)
                      setFeedbackType('')
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                      isCorrect === true
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-green-300'
                    }`}
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">Correct</span>
                  </button>
                  <button
                    onClick={() => setIsCorrect(false)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                      isCorrect === false
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-red-300'
                    }`}
                  >
                    <XCircle className="w-5 h-5" />
                    <span className="font-medium">Incorrect</span>
                  </button>
                </div>
              </div>

              {isCorrect === false && (
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                    What type of issue is this?
                  </p>
                  <select
                    value={feedbackType}
                    onChange={(e) => setFeedbackType(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  >
                    <option value="">Select issue type...</option>
                    <option value="false_positive">
                      False Positive - Item exists but was flagged as missing
                    </option>
                    <option value="false_negative">
                      False Negative - Item is missing but wasn't flagged
                    </option>
                    <option value="incorrect_match">
                      Incorrect Match - Items matched incorrectly
                    </option>
                    <option value="other">Other Issue</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  <MessageSquare className="w-4 h-4 inline mr-1" />
                  Additional Comments (Optional)
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Please provide details about why this result is correct or incorrect..."
                  rows={4}
                  className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                />
              </div>

              {isCorrect === false && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                      How does this item appear in the Adjuster's estimate?
                    </label>
                    <textarea
                      value={adjusterData}
                      onChange={(e) => setAdjusterData(e.target.value)}
                      placeholder="Paste or describe how this item appears in the adjuster's estimate..."
                      rows={2}
                      className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                      How does this item appear in the Contractor's estimate?
                    </label>
                    <textarea
                      value={contractorData}
                      onChange={(e) => setContractorData(e.target.value)}
                      placeholder="Paste or describe how this item appears in the contractor's estimate..."
                      rows={2}
                      className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || isCorrect === null}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Feedback'
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
