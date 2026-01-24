'use client'

interface TrainingContentViewerProps {
  content: string | null
  className?: string
}

export default function TrainingContentViewer({ content, className = '' }: TrainingContentViewerProps) {
  if (!content) {
    return (
      <div className={`text-center py-12 text-gray-500 dark:text-gray-400 ${className}`}>
        <p>No content available for this training course.</p>
      </div>
    )
  }

  return (
    <div
      className={`prose prose-lg dark:prose-invert max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: content }}
      style={{
        wordBreak: 'break-word',
      }}
    />
  )
}
