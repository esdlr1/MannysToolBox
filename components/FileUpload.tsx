'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useSession } from 'next-auth/react'

interface FileUploadProps {
  toolId?: string
  onUploadComplete?: (file: { id: string; filename: string; originalName: string; url: string }) => void
  accept?: Record<string, string[]>
  maxSize?: number
  multiple?: boolean
}

export function FileUpload({ 
  toolId, 
  onUploadComplete, 
  accept,
  maxSize = 10 * 1024 * 1024, // 10MB default
  multiple = false 
}: FileUploadProps) {
  const { data: session } = useSession()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ id: string; filename: string; originalName: string; url: string }>>([])

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!session) {
      setError('Please sign in to upload files')
      return
    }

    setError('')
    setUploading(true)

    try {
      const uploadPromises = acceptedFiles.map(async (file) => {
        const formData = new FormData()
        formData.append('file', file)
        if (toolId) {
          formData.append('toolId', toolId)
        }

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Upload failed')
        }

        const data = await response.json()
        return data.file
      })

      const files = await Promise.all(uploadPromises)
      setUploadedFiles(prev => [...prev, ...files])
      
      files.forEach(file => {
        if (onUploadComplete) {
          onUploadComplete(file)
        }
      })
    } catch (err: any) {
      setError(err.message || 'Failed to upload file')
    } finally {
      setUploading(false)
    }
  }, [session, toolId, onUploadComplete])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxSize,
    multiple,
    disabled: !session || uploading,
  })

  if (!session) {
    return (
      <div className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center text-gray-500 dark:text-gray-400">
        Please sign in to upload files
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
          isDragActive
            ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-red-400 dark:hover:border-red-600'
        } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="text-center">
          {uploading ? (
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin mb-2"></div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Uploading...</p>
            </div>
          ) : (
            <>
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {isDragActive ? 'Drop files here' : 'Drag and drop files here, or click to select'}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                Max size: {(maxSize / 1024 / 1024).toFixed(0)}MB
              </p>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-300 rounded text-sm">
          {error}
        </div>
      )}

      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Uploaded Files:</p>
          {uploadedFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded"
            >
              <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{file.originalName}</span>
              <a
                href={file.url}
                download
                className="ml-2 text-sm text-red-600 dark:text-red-400 hover:underline"
              >
                Download
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
