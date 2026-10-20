"use client"

import * as React from "react"
import { useDropzone } from "react-dropzone"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Upload, FileText, X, Loader2, CheckCircle, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface DocumentUploadProps {
  onSuccess?: (document: { id: string; title: string }) => void
  subjectId?: string
  projectId?: string
  notebookId?: string
  multiple?: boolean
  maxFiles?: number
}

const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png',
  'image/jpeg',
]

const MAX_FILE_SIZE = 50 * 1024 * 1024

export function DocumentUpload({
  onSuccess,
  subjectId,
  projectId,
  notebookId,
  multiple = true,
  maxFiles = 10,
}: DocumentUploadProps) {
  const [files, setFiles] = React.useState<File[]>([])
  const [uploading, setUploading] = React.useState(false)
  const [progress, setProgress] = React.useState<Record<string, number>>({})
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [showConfirm, setShowConfirm] = React.useState(false)

  const onDrop = React.useCallback((acceptedFiles: File[]) => {
    const validFiles = acceptedFiles.filter(file => {
      if (file.size > MAX_FILE_SIZE) {
        setErrors(prev => ({ ...prev, [file.name]: `File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` }))
        return false
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        setErrors(prev => ({ ...prev, [file.name]: 'File type not supported' }))
        return false
      }
      return true
    })
    setFiles(prev => [...prev, ...validFiles].slice(0, maxFiles))
  }, [maxFiles])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-powerpoint': ['.ppt'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    },
    multiple,
    maxFiles,
    maxSize: MAX_FILE_SIZE,
  })

  const removeFile = (fileName: string) => {
    setFiles(prev => prev.filter(f => f.name !== fileName))
    setErrors(prev => { const next = { ...prev }; delete next[fileName]; return next })
    setProgress(prev => { const next = { ...prev }; delete next[fileName]; return next })
  }

  const handleUpload = async () => {
    if (files.length === 0) return
    setUploading(true)
    setErrors({})

    for (const file of files) {
      try {
        setProgress(prev => ({ ...prev, [file.name]: 0 }))
        
        const formData = new FormData()
        formData.append('file', file)
        if (subjectId) formData.append('subjectId', subjectId)
        if (projectId) formData.append('projectId', projectId)
        if (notebookId) formData.append('notebookId', notebookId)

        const response = await fetch('/api/documents', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Upload failed')
        }

        const data = await response.json()
        setProgress(prev => ({ ...prev, [file.name]: 100 }))
        onSuccess?.(data.document)
      } catch (error) {
        setErrors(prev => ({ ...prev, [file.name]: error instanceof Error ? error.message : 'Upload failed' }))
      }
    }

    setUploading(false)
    setFiles([])
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Documents
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          {...getRootProps()}
          className={cn(
            "relative border-2 border-dashed rounded-lg p-6 text-center transition-colors",
            isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
          )}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            {isDragActive ? "Drop files here..." : "Drag & drop files here, or click to select"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            PDF, DOC, DOCX, TXT, MD, CSV, XLS, XLSX, PPT, PPTX, PNG, JPG (max 50MB each)
          </p>
        </div>

        {files.length > 0 && (
          <div className="mt-4 space-y-3">
            <h4 className="text-sm font-medium">Files to upload ({files.length})</h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {files.map(file => (
                <div key={file.name} className="flex items-center gap-3 p-3 border rounded-lg">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    {progress[file.name] !== undefined && (
                      <Progress value={progress[file.name]} className="mt-1 h-1" />
                    )}
                  </div>
{errors[file.name] && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertCircle className="h-5 w-5 text-destructive" />
                        </TooltipTrigger>
                        <TooltipContent side="top">{errors[file.name]}</TooltipContent>
                      </Tooltip>
                    )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFile(file.name)}
                    disabled={uploading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    onClick={handleUpload}
                    disabled={uploading || files.length === 0}
                    className="flex-1"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      "Upload Files"
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Upload</AlertDialogTitle>
                    <AlertDialogDescription>
                      Upload {files.length} file{files.length > 1 ? 's' : ''}? Processing will begin immediately.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogAction onClick={handleUpload}>Upload</AlertDialogAction>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                </AlertDialogContent>
              </AlertDialog>
              <Button variant="outline" onClick={() => setFiles([])} disabled={uploading}>
                Clear All
              </Button>
            </div>
          </div>
        )}

        {Object.keys(errors).length > 0 && (
          <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <h5 className="text-sm font-medium text-destructive">Errors</h5>
            <ul className="mt-1 text-sm text-destructive">
              {Object.entries(errors).map(([fileName, error]) => (
                <li key={fileName}>{fileName}: {error}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}