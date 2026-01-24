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
    <>
      <div
        className={`prose prose-lg dark:prose-invert max-w-none ${className}`}
        dangerouslySetInnerHTML={{ __html: content }}
        style={{
          wordBreak: 'break-word',
        }}
      />
      <style jsx global>{`
        .youtube-embed-wrapper {
          position: relative;
          padding-bottom: 56.25%;
          height: 0;
          overflow: hidden;
          max-width: 100%;
          margin: 1rem 0;
          border-radius: 0.5rem;
          background: #000;
        }
        .youtube-embed-wrapper iframe {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          border: none;
        }
      `}</style>
    </>
  )
}
