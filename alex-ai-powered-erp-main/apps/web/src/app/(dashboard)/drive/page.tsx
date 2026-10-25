"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Cloud, ExternalLink, Unplug, Folder, File, ChevronRight,
  Loader2, Download, Check, X, ArrowUp, RefreshCw
} from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

interface DropboxEntry {
  id: string
  name: string
  path: string
  type: 'file' | 'folder'
  size?: number
  modified?: string
  isImportable: boolean
}

export default function DrivePage() {
  const queryClient = useQueryClient()
  const [currentPath, setCurrentPath] = React.useState('')
  const [selectedFiles, setSelectedFiles] = React.useState<Set<string>>(new Set())
  const [isImporting, setIsImporting] = React.useState(false)
  const [importResults, setImportResults] = React.useState<{ imported: number; failed: number; results: any[] } | null>(null)

  const { data: connectionData, isLoading: connectionLoading } = useQuery({
    queryKey: ["dropbox-connection"],
    queryFn: async () => (await fetch("/api/storage/dropbox")).json(),
  })

  const connected = Boolean(connectionData?.connected)

  const { data: listData, isLoading: listLoading, refetch: refetchList } = useQuery({
    queryKey: ["dropbox-files", currentPath],
    queryFn: async () => {
      const params = new URLSearchParams({ path: currentPath })
      const res = await fetch(`/api/storage/dropbox/list?${params}`)
      if (!res.ok) throw new Error("Failed to list files")
      return res.json()
    },
    enabled: connected,
    placeholderData: (previous) => previous,
  })

  const importMutation = useMutation({
    mutationFn: async (paths: string[]) => {
      const res = await fetch("/api/storage/dropbox/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths }),
      })
      if (!res.ok) throw new Error("Import failed")
      return res.json()
    },
    onSuccess: (data) => {
      setImportResults(data)
      setIsImporting(false)
      setSelectedFiles(new Set())
      queryClient.invalidateQueries({ queryKey: ["documents"] })
    },
    onError: () => {
      setIsImporting(false)
    },
  })

  const handleSelectFile = (path: string) => {
    const newSelected = new Set(selectedFiles)
    if (newSelected.has(path)) {
      newSelected.delete(path)
    } else {
      newSelected.add(path)
    }
    setSelectedFiles(newSelected)
  }

  const handleSelectAll = (entries: DropboxEntry[]) => {
    const importable = entries.filter(e => e.isImportable).map(e => e.path)
    if (importable.length === selectedFiles.size && importable.every(p => selectedFiles.has(p))) {
      setSelectedFiles(new Set())
    } else {
      setSelectedFiles(new Set(importable))
    }
  }

  const handleImport = () => {
    if (selectedFiles.size === 0) return
    setIsImporting(true)
    importMutation.mutate(Array.from(selectedFiles))
  }

  const handleNavigate = (path: string) => {
    setCurrentPath(path)
    setSelectedFiles(new Set())
  }

  const handleGoUp = () => {
    if (!currentPath) return
    const parts = currentPath.split('/').filter(Boolean)
    parts.pop()
    setCurrentPath('/' + parts.join('/'))
    setSelectedFiles(new Set())
  }

  const formatSize = (bytes?: number) => {
    if (!bytes) return ''
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Personal Drive</h1>
        <p className="mt-1 text-muted-foreground">Connect Dropbox to browse and import files into ALEX.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Dropbox Connection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {connectionLoading ? (
            <p className="text-muted-foreground">Checking connection…</p>
          ) : connected ? (
            <>
              <div className="flex items-center justify-between">
                <p>Connected to {connectionData.connection?.accountEmail || "your Dropbox account"}.</p>
                <Button variant="outline" onClick={async () => { await fetch("/api/storage/dropbox", { method: "DELETE" }); location.reload() }}>
                  <Unplug className="mr-2 h-4 w-4" />
                  Disconnect
                </Button>
              </div>
              {connected && (
                <div className="pt-4 border-t border-border">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mb-2">
                    <Button
                      variant={currentPath ? "outline" : "ghost"}
                      size="sm"
                      onClick={handleGoUp}
                      disabled={!currentPath}
                      className="w-full sm:w-auto"
                    >
                      <ArrowUp className="mr-1.5 h-3.5 w-3.5" />
                      Up
                    </Button>
                    <span className="text-sm text-muted-foreground flex-1 truncate sm:mt-1">
                      {currentPath ? '/' + currentPath : '/ (root)'}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => refetchList()} className="w-full sm:w-auto">
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      Refresh
                    </Button>
                  </div>

                  <Card className="border-border">
                    <CardHeader className="pb-2">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <CardTitle className="text-base">Files</CardTitle>
                        {listData?.entries?.some(e => e.isImportable) && (
                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSelectAll(listData.entries as DropboxEntry[])}
                              className={cn(
                                selectedFiles.size === (listData.entries as DropboxEntry[])?.filter(e => e.isImportable).length ? "bg-primary text-primary-foreground" : "",
                                "w-full sm:w-auto"
                              )}
                            >
                              <Check className="mr-1.5 h-3.5 w-3.5" />
                              Select All Importable
                            </Button>
                            <Button
                              size="sm"
                              onClick={handleImport}
                              disabled={selectedFiles.size === 0 || isImporting}
                              className="w-full sm:w-auto"
                            >
                              <Download className="mr-1.5 h-3.5 w-3.5" />
                              Import Selected ({selectedFiles.size})
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      {listLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      ) : listData?.entries?.length === 0 ? (
                        <div className="py-12 text-center text-muted-foreground">
                          <Folder className="mx-auto h-12 w-12 text-muted-foreground/50 mb-2" />
                          <p>This folder is empty</p>
                        </div>
                      ) : (
                        <ScrollArea className="max-h-[500px]">
                          <div className="divide-y divide-border">
                            {(listData?.entries as DropboxEntry[] || []).map((entry) => {
                              const isSelected = selectedFiles.has(entry.path)
                              const isFolder = entry.type === 'folder'
                              const isImportable = entry.isImportable

                              return (
                                <button
                                  key={entry.id}
                                  onClick={() => isFolder ? handleNavigate(entry.path) : handleSelectFile(entry.path)}
                                  className={cn(
                                    "w-full flex items-center gap-3 p-4 hover:bg-accent/50 transition-colors text-left",
                                    isSelected && "bg-primary/5 border-l-2 border-primary"
                                  )}
                                >
                                  {isFolder ? (
                                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                  ) : isImportable ? (
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={() => handleSelectFile(entry.path)}
                                      className="flex-shrink-0"
                                    />
                                  ) : (
                                    <span className="w-6 flex-shrink-0" />
                                  )}
                                  <div className={cn(
                                    "flex-1 min-w-0 flex items-center gap-3",
                                    !isImportable && !isFolder && "text-muted-foreground/50"
                                  )}>
                                    {isFolder ? (
                                      <Folder className="h-6 w-6 text-amber-500" />
                                    ) : isImportable ? (
                                      <File className="h-6 w-6 text-blue-500" />
                                    ) : (
                                      <File className="h-6 w-6 text-muted-foreground/30" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className={cn("text-base font-medium truncate", isFolder ? "text-foreground" : "text-foreground")}>
                                        {entry.name}
                                      </p>
                                      <p className="text-sm text-muted-foreground truncate flex items-center gap-2">
                                        {entry.size && formatSize(entry.size)}
                                        {entry.modified && '· Modified ' + new Date(entry.modified).toLocaleDateString()}
                                      </p>
                                    </div>
                                  </div>
                                  {!isFolder && !isImportable && (
                                    <span className="text-sm text-muted-foreground/50 px-3 py-1 rounded bg-muted">
                                      Unsupported
                                    </span>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        </ScrollArea>
                      )}
                    </CardContent>
                  </Card>

                  {listData?.hasMore && (
                    <Button
                      variant="outline"
                      className="w-full mt-2"
                      onClick={() => refetchList()}
                      disabled={listLoading}
                    >
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Load More
                    </Button>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-muted-foreground">ALEX will use an app-specific Dropbox folder and will not access unrelated files.</p>
              <Button asChild>
                <a href="/api/storage/dropbox/connect">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Connect Dropbox
                </a>
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {importResults && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Check className="h-5 w-5 text-emerald-500" />
              <div>
                <p className="font-medium">Import Complete</p>
                <p className="text-sm text-muted-foreground">
                  {importResults.imported} imported, {importResults.failed} failed
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setImportResults(null)}>
              <X className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}