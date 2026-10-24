"use client"

import * as React from "react"
import { useState, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog"
import { Textarea } from "@/components/ui/textarea"
import { 
  Brain, 
  Key, 
  Settings, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  Sparkles,
  Wifi,
  WifiOff,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  Plus,
  TestTube,
  Shield,
  Zap,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Search,
  PlusCircle,
  AlertTriangle,
  Check,
  X,
  Clock,
  Cloud,
  WifiHigh,
  AlertCircle as AlertCircleIcon,
  FileText,
  Image,
  Zap as ZapIcon,
} from "lucide-react"
import { cn, formatRelativeTime } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"
import type { DiscoveredModel } from "@/lib/ai/model-discovery"

type ValidationTaskType = 'chat' | 'embeddings' | 'vision' | 'reasoning' | 'structured' | 'function-calling'
type ModelTestStatus = 'untested' | 'testing' | 'valid' | 'invalid' | 'unavailable'

// Map ValidationTaskType to AITaskType for API calls
function toAITaskType(task: ValidationTaskType): 'chat' | 'embeddings' | 'reasoning' | 'vision' | 'structured' {
  if (task === 'function-calling') return 'chat' // Function calling tested via chat endpoint
  return task
}

const TASK_TYPE_LABELS: Record<ValidationTaskType, string> = {
  chat: 'Chat',
  embeddings: 'Embeddings',
  vision: 'Vision',
  reasoning: 'Reasoning',
  structured: 'Structured Output',
  'function-calling': 'Function Calling',
}

const TASK_TYPE_ICONS: Record<ValidationTaskType, React.ReactNode> = {
  chat: <Brain className="h-4 w-4" />,
  embeddings: <FileText className="h-4 w-4" />,
  vision: <Image className="h-4 w-4" />,
  reasoning: <ZapIcon className="h-4 w-4" />,
  structured: <FileText className="h-4 w-4" />,
  'function-calling': <Zap className="h-4 w-4" />,
}

function getStatusBadge(status: ModelTestStatus | undefined) {
  switch (status) {
    case 'valid':
      return <Badge variant="default" className="gap-1"><CheckCircle className="h-3 w-3" /> Validated</Badge>
    case 'invalid':
      return <Badge variant="destructive" className="gap-1"><AlertCircleIcon className="h-3 w-3" /> Failed</Badge>
    case 'testing':
      return <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Testing...</Badge>
    case 'unavailable':
      return <Badge variant="outline" className="gap-1"><WifiOff className="h-3 w-3" /> Unavailable</Badge>
    default:
      return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Untested</Badge>
  }
}

function getDeprecationBadge(model: DiscoveredModel) {
  if (model.isDeprecated) {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="h-3 w-3" />
        Deprecated{model.deprecationReason ? ` - ${model.deprecationReason}` : ''}
      </Badge>
    )
  }
  return null
}

function getCapabilitiesDisplay(model: DiscoveredModel) {
  const capabilities = model.capabilities || []
  const confirmed = model.confirmedTasks || []
  
  return (
    <div className="flex flex-wrap gap-1">
      {capabilities.map((cap) => {
        const isConfirmed = confirmed.includes(cap as 'chat' | 'embeddings' | 'reasoning' | 'vision' | 'structured' | 'summarization')
        return (
          <Badge 
            key={cap} 
            variant={isConfirmed ? 'default' : 'outline'}
            className="text-xs"
          >
            {cap}{isConfirmed ? ' ✓' : ''}
          </Badge>
        )
      })}
    </div>
  )
}

interface AICredential {
  id: string
  provider: string
  providerName: string
  isActive: boolean
  isDefault: boolean
  models: string[]
  usageLimit?: number
  usageCount: number
  lastUsedAt?: string
  createdAt: string
}

interface AIModelConfig {
  id: string
  provider: string
  modelId: string
  taskType: string
  isDefault: boolean
  parameters: Record<string, unknown>
}

const PROVIDER_INFO: Record<string, { name: string; icon: React.ReactNode; models: string[]; embeddingModels: string[]; capabilities: string[] }> = {
  OPENAI: {
    name: "OpenAI",
    icon: <Brain className="h-5 w-5" />,
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
    embeddingModels: ["text-embedding-3-small", "text-embedding-3-large", "text-embedding-ada-002"],
    capabilities: ["chat", "embeddings", "functions", "vision"],
  },
  GOOGLE_GEMINI: {
    name: "Google Gemini",
    icon: <Sparkles className="h-5 w-5" />,
    models: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-1.0-pro"],
    embeddingModels: ["text-embedding-004", "embedding-001"],
    capabilities: ["chat", "embeddings", "vision"],
  },
  ANTHROPIC: {
    name: "Anthropic",
    icon: <Zap className="h-5 w-5" />,
    models: ["claude-3-5-sonnet-20241022", "claude-3-opus-20240229", "claude-3-haiku-20240307"],
    embeddingModels: [],
    capabilities: ["chat", "functions", "vision"],
  },
  NVIDIA_NEMOTRON: {
    name: "NVIDIA Nemotron",
    icon: <Shield className="h-5 w-5" />,
    models: ["nvidia/nemotron-3-ultra", "nvidia/nemotron-3-ultra-550b-a55b", "nvidia/nemotron-3-large", "nvidia/llama-3.1-nemotron-70b-instruct"],
    embeddingModels: [],
    capabilities: ["chat", "reasoning"],
  },
  GROQ: {
    name: "Groq",
    icon: <Wifi className="h-5 w-5" />,
    models: ["qwen/qwen3.8-27b", "openai/gpt-oss-20b"],
    embeddingModels: [],
    capabilities: ["chat", "fast-inference"],
  },
  MISTRAL: {
    name: "Mistral AI",
    icon: <Brain className="h-5 w-5" />,
    models: ["mistral-large-latest", "mistral-small-latest", "open-mistral-7b"],
    embeddingModels: ["mistral-embed"],
    capabilities: ["chat", "embeddings"],
  },
  OPENROUTER: {
    name: "OpenRouter",
    icon: <Zap className="h-5 w-5" />,
    models: ["openrouter/auto", "anthropic/claude-3.5-sonnet", "google/gemini-pro"],
    embeddingModels: [],
    capabilities: ["chat", "multiple-models"],
  },
  TOGETHER_AI: {
    name: "Together AI",
    icon: <Sparkles className="h-5 w-5" />,
    models: ["meta-llama/Meta-Llama-3.1-70B", "mistralai/Mixtral-8x7B"],
    embeddingModels: [],
    capabilities: ["chat", "embeddings", "open-source"],
  },
}

export default function AISettingsPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<"credentials" | "models" | "test">("credentials")
  const [testingProvider, setTestingProvider] = useState<string>("")
  const [testApiKey, setTestApiKey] = useState("")
  const [testModel, setTestModel] = useState("")
  const [testQuery, setTestQuery] = useState("Hello, how are you?")
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; response?: string; error?: string } | null>(null)

  // Model discovery state
  const [discoverProvider, setDiscoverProvider] = useState<string>("")
  const [discoverCredentialId, setDiscoverCredentialId] = useState<string>("")
  const [discoverTaskType, setDiscoverTaskType] = useState<string>("")
  const [discoveredModels, setDiscoveredModels] = useState<DiscoveredModel[]>([])
  const [discoverCached, setDiscoverCached] = useState(false)
  const [discoverError, setDiscoverError] = useState<string | null>(null)
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set())

  // Custom model state
  const [customProvider, setCustomProvider] = useState<string>("")
  const [customModelId, setCustomModelId] = useState<string>("")
  const [customTaskType, setCustomTaskType] = useState<ValidationTaskType>("chat")
  const [isTestingCustom, setIsTestingCustom] = useState(false)
  const [customTestResult, setCustomTestResult] = useState<{ valid: boolean; error?: string; model?: DiscoveredModel; testDetails?: any } | null>(null)

  const { data: credentials = [], isLoading: credsLoading } = useQuery({
    queryKey: ["ai-credentials"],
    queryFn: async () => {
      const res = await fetch("/api/ai/credentials")
      if (!res.ok) throw new Error("Failed to fetch credentials")
      return res.json()
    },
  })

  const { data: modelConfigs = [], isLoading: modelsLoading } = useQuery({
    queryKey: ["ai-model-configs"],
    queryFn: async () => {
      const res = await fetch("/api/ai/models")
      if (!res.ok) throw new Error("Failed to fetch model configs")
      return res.json()
    },
  })

  const addCredentialMutation = useMutation({
    mutationFn: async (data: { provider: string; providerName: string; apiKey: string; models?: string[]; isDefault?: boolean }) => {
      const res = await fetch("/api/ai/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to add credential")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-credentials"] })
      toast({ title: "API key added successfully" })
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    },
  })

  const deleteCredentialMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/ai/credentials/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete credential")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-credentials"] })
      toast({ title: "API key deleted" })
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    },
  })

  const updateModelConfigMutation = useMutation({
    mutationFn: async (data: { provider: string; modelId: string; taskType: string; isDefault: boolean; parameters?: Record<string, unknown> }) => {
      const res = await fetch("/api/ai/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to update model config")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-model-configs"] })
      toast({ title: "Model configuration updated" })
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    },
  })

  const testConnectionMutation = useMutation({
    mutationFn: async (data: { provider?: string; apiKey?: string; credentialId?: string; model?: string; query?: string; useSavedConfig?: boolean }) => {
      const res = await fetch("/api/ai/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Connection test failed")
      }
      return res.json()
    },
    onSuccess: (data) => {
      setTestResult({ success: true, response: data.response })
      toast({ title: "Connection successful!" })
    },
    onError: (error: Error) => {
      setTestResult({ success: false, error: error.message })
      toast({ title: "Connection failed", description: error.message, variant: "destructive" })
    },
    onSettled: () => setIsTesting(false),
  })

  const maskKey = (key: string) => {
    if (key.length <= 8) return "****"
    return key.slice(0, 4) + "****" + key.slice(-4)
  }

  const handleTestConnection = useCallback((eventOrFlag?: boolean | React.MouseEvent<HTMLButtonElement>) => {
    const useSavedConfig = typeof eventOrFlag === 'boolean' ? eventOrFlag : false
    const savedCred = credentials.find((c: AICredential) => c.provider === testingProvider && c.isActive)
    if (!testingProvider) {
      toast({ title: "Error", description: "Please select a provider", variant: "destructive" })
      return
    }
    if (!useSavedConfig && !testApiKey && !savedCred) {
      toast({ title: "Error", description: "Please select a provider and enter an API key (or configure one in Credentials)", variant: "destructive" })
      return
    }
    if (useSavedConfig && !savedCred) {
      toast({ title: "Error", description: "No saved credential found for this provider", variant: "destructive" })
      return
    }
    setIsTesting(true)
    setTestResult(null)
    testConnectionMutation.mutate({
      provider: testingProvider,
      apiKey: useSavedConfig ? undefined : (testApiKey || undefined),
      credentialId: (useSavedConfig || !testApiKey) && savedCred ? savedCred.id : undefined,
      model: testModel || undefined,
      query: testQuery || undefined,
      useSavedConfig,
    })
  }, [testingProvider, testApiKey, testModel, testConnectionMutation, credentials])

  // Model discovery handlers
  const handleDiscoverModels = useCallback(async (forceRefresh = false) => {
    if (!discoverProvider) {
      toast({ title: "Error", description: "Please select a provider", variant: "destructive" })
      return
    }

    setIsDiscovering(true)
    setDiscoverError(null)

    try {
      const params = new URLSearchParams()
      params.set('provider', discoverProvider)
      if (discoverCredentialId) params.set('credentialId', discoverCredentialId)
      if (discoverTaskType) params.set('taskType', discoverTaskType)
      if (forceRefresh) params.set('refresh', 'true')

      const res = await fetch(`/api/ai/models/discover?${params.toString()}`)
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to discover models")
      }

      const data = await res.json()
      setDiscoveredModels(data.models || [])
      setDiscoverCached(data.cached || false)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to discover models"
      setDiscoverError(message)
      toast({ title: "Error", description: message, variant: "destructive" })
    } finally {
      setIsDiscovering(false)
    }
  }, [discoverProvider, discoverCredentialId, discoverTaskType])

  const handleSelectAllModels = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedModels(new Set(discoveredModels.map((m: { id: string }) => m.id)))
    } else {
      setSelectedModels(new Set())
    }
  }, [discoveredModels])

  const handleToggleModel = useCallback((modelId: string, checked: boolean) => {
    setSelectedModels(prev => {
      const next = new Set(prev)
      if (checked) next.add(modelId)
      else next.delete(modelId)
      return next
    })
  }, [])

  const handleSelectModelForTask = useCallback((modelId: string) => {
    const model = discoveredModels.find(m => m.id === modelId)
    if (!model) return

    const config = modelConfigs.find((c: AIModelConfig) => c.taskType === discoverTaskType && c.isDefault)
    if (config) {
      updateModelConfigMutation.mutate({
        ...config,
        modelId: model.id,
        taskType: discoverTaskType,
        isDefault: true,
      })
      toast({ title: "Model selected", description: `${model.id} set as default for ${discoverTaskType}` })
    }
  }, [discoveredModels, discoverTaskType, modelConfigs, updateModelConfigMutation])

  const handleSaveSelectedModels = useCallback(() => {
    if (selectedModels.size === 0) return

    const modelsToSave = Array.from(selectedModels).map(id => 
      discoveredModels.find((m: { id: string }) => m.id === id)
    ).filter(Boolean)

    if (modelsToSave.length > 0) {
      const firstModel = modelsToSave[0]
      const config = modelConfigs.find((c: AIModelConfig) => c.taskType === discoverTaskType && c.isDefault)
      if (config) {
        updateModelConfigMutation.mutate({
          ...config,
          modelId: firstModel!.id,
          taskType: discoverTaskType,
          isDefault: true,
        })
        toast({ title: "Model saved", description: `${firstModel!.id} set as default for ${discoverTaskType}` })
      }
    }
    setSelectedModels(new Set())
  }, [selectedModels, discoveredModels, discoverTaskType, modelConfigs, updateModelConfigMutation])

  // Custom model handlers
  const handleTestCustomModel = useCallback(async () => {
    if (!customProvider || !customModelId || !customTaskType) {
      toast({ title: "Error", description: "Please fill all fields", variant: "destructive" })
      return
    }

    setIsTestingCustom(true)
    setCustomTestResult(null)

    try {
      const res = await fetch("/api/ai/models/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: customProvider,
          modelId: customModelId,
          taskType: toAITaskType(customTaskType),
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Validation failed")
      }

      const data = await res.json()
      setCustomTestResult(data)
      toast({ title: data.valid ? "Model validated" : "Validation failed", description: data.error, variant: data.valid ? "default" : "destructive" })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Validation failed"
      setCustomTestResult({ valid: false, error: message, testDetails: null })
      toast({ title: "Validation failed", description: message, variant: "destructive" })
    } finally {
      setIsTestingCustom(false)
    }
  }, [customProvider, customModelId, customTaskType])

  // Test discovered model for specific task
  const handleTestDiscoveredModel = useCallback(async (modelId: string, taskType: ValidationTaskType) => {
    if (!discoverProvider || !discoverCredentialId) {
      toast({ title: "Error", description: "Please select provider and credential", variant: "destructive" })
      return
    }

    // Update model status to testing
    setDiscoveredModels(prev => prev.map(m => 
      m.id === modelId ? { ...m, testStatus: 'testing' as ModelTestStatus } : m
    ))

    try {
      const res = await fetch("/api/ai/models/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: discoverProvider,
          modelId,
          credentialId: discoverCredentialId,
          taskType: toAITaskType(taskType),
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Validation failed")
      }

      const data = await res.json()
      
      // Update model with test result
      setDiscoveredModels(prev => prev.map(m => {
        if (m.id === modelId) {
          // Convert ValidationTaskType to AITaskType for confirmedTasks
          const taskForConfirmed = taskType === 'function-calling' ? 'chat' : taskType
          const confirmedTasks = data.valid && m.confirmedTasks 
            ? [...new Set([...m.confirmedTasks, taskForConfirmed as 'chat' | 'embeddings' | 'reasoning' | 'vision' | 'structured' | 'summarization'])] 
            : m.confirmedTasks
          return {
            ...m,
            testStatus: data.valid ? 'valid' : 'invalid',
            testError: data.error,
            lastTestedAt: new Date(),
            confirmedTasks,
          }
        }
        return m
      }))

      toast({ 
        title: data.valid ? `${TASK_TYPE_LABELS[taskType]} test passed` : `${TASK_TYPE_LABELS[taskType]} test failed`, 
        description: data.error, 
        variant: data.valid ? "default" : "destructive" 
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Validation failed"
      setDiscoveredModels(prev => prev.map(m => 
        m.id === modelId ? { ...m, testStatus: 'invalid' as ModelTestStatus, testError: message } : m
      ))
      toast({ title: "Test failed", description: message, variant: "destructive" })
    }
  }, [discoverProvider, discoverCredentialId])

  const handleSaveCustomModel = useCallback(async () => {
    if (!customProvider || !customModelId || !customTaskType) {
      toast({ title: "Error", description: "Please fill all fields", variant: "destructive" })
      return
    }

    try {
      const res = await fetch("/api/ai/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: customProvider,
          modelId: customModelId,
          taskType: customTaskType,
          isDefault: true,
          isCustom: true,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to save custom model")
      }

      const data = await res.json()
      queryClient.invalidateQueries({ queryKey: ["ai-model-configs"] })
      toast({ title: "Custom model saved" })
      setCustomModelId("")
      setCustomTaskType("chat")
      setCustomTestResult(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save custom model"
      toast({ title: "Error", description: message, variant: "destructive" })
    }
  }, [customProvider, customModelId, customTaskType, queryClient])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Brain className="h-8 w-8 text-primary" />
          AI Model & API Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure AI providers, models, and test connections for your personal assistant.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v: "credentials" | "models" | "test") => setActiveTab(v)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="credentials">
            <Key className="mr-2 h-4 w-4" />
            API Credentials
          </TabsTrigger>
          <TabsTrigger value="models">
            <Settings className="mr-2 h-4 w-4" />
            Model Selection
          </TabsTrigger>
          <TabsTrigger value="test">
            <TestTube className="mr-2 h-4 w-4" />
            Test Connection
          </TabsTrigger>
        </TabsList>

        {/* Credentials Tab */}
        <TabsContent value="credentials" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    API Credentials
                  </CardTitle>
                  <CardDescription>
                    Manage your AI provider API keys. Keys are encrypted and never exposed.
                  </CardDescription>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Credential
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New API Credential</DialogTitle>
                    </DialogHeader>
                    <AddCredentialForm onSuccess={() => queryClient.invalidateQueries({ queryKey: ["ai-credentials"] })} />
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {credsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : credentials.length === 0 ? (
                <div className="text-center py-12">
                  <Key className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-2 text-muted-foreground">No API credentials configured</p>
                  <p className="text-sm text-muted-foreground mt-1">Add your first API key to get started</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provider</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Models</TableHead>
                      <TableHead>Usage</TableHead>
                      <TableHead>Last Used</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {credentials.map((cred: AICredential) => (
                      <TableRow key={cred.id}>
                        <TableCell className="flex items-center gap-2">
                          {PROVIDER_INFO[cred.provider]?.icon || <Brain className="h-5 w-5" />}
                          <span className="font-medium">{cred.providerName || cred.provider}</span>
                          {cred.isDefault && <Badge variant="default" className="ml-2">Default</Badge>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={cred.isActive ? "default" : "secondary"}>
                            {cred.isActive ? <Wifi className="mr-1 h-3 w-3" /> : <WifiOff className="mr-1 h-3 w-3" />}
                            {cred.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {cred.models?.slice(0, 3).map((m: string) => (
                              <Badge key={m} variant="outline" className="text-xs">{m}</Badge>
                            ))}
                            {(cred.models?.length || 0) > 3 && (
                              <Badge variant="outline" className="text-xs">+{(cred.models?.length || 0) - 3} more</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {cred.usageLimit ? `${cred.usageCount}/${cred.usageLimit}` : `${cred.usageCount}`}
                        </TableCell>
                        <TableCell>
                          {cred.lastUsedAt ? formatRelativeTime(cred.lastUsedAt) : "Never"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete API Key?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently remove the API key for {cred.providerName || cred.provider}. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <div className="flex gap-2 justify-end">
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteCredentialMutation.mutate(cred.id)}>
                                    Delete
                                  </AlertDialogAction>
                                </div>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>• API keys are encrypted using AES-256-GCM before storage</p>
              <p>• Keys are never logged or exposed in frontend code</p>
              <p>• Each key is scoped to your user account only</p>
              <p>• Usage is tracked per provider for quota management</p>
              <p>• You can set usage limits per credential</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Models Tab */}
        <TabsContent value="models" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Default Models by Task
              </CardTitle>
              <CardDescription>
                Select which model to use for each type of AI task. The default model will be used automatically.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {modelsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task Type</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Default</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {["chat", "embeddings", "reasoning", "vision"].map(taskType => {
                      const config = modelConfigs.find((c: AIModelConfig) => c.taskType === taskType && c.isDefault)
                      const isEmbeddingsTask = taskType === "embeddings"
                      const capableProviders = Object.entries(PROVIDER_INFO)
                        .filter(([, info]) => isEmbeddingsTask ? info.capabilities.includes("embeddings") : true)
                        .map(([key]) => key)
                      
                      // Combine hardcoded models with discovered models
                      const getModelsForProvider = (provider: string) => {
                        const hardcoded = PROVIDER_INFO[provider]?.models || []
                        const embeddingModels = PROVIDER_INFO[provider]?.embeddingModels || []
                        const discovered = discoveredModels.filter((m: DiscoveredModel) => m.provider === provider)
                        const allModels = [...new Set([...hardcoded, ...embeddingModels, ...discovered.map((m: DiscoveredModel) => m.id)])]
                        return allModels
                      }
                      
                      return (
                        <TableRow key={taskType}>
                          <TableCell>
                            <span className="capitalize font-medium">{taskType}</span>
                            <p className="text-xs text-muted-foreground">
                              {taskType === "chat" ? "General conversation and Q&A" :
                               taskType === "embeddings" ? "Document search and retrieval (requires embedding-capable provider)" :
                               taskType === "reasoning" ? "Complex problem solving" :
                               "Image analysis"}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Select value={config?.provider || ""} onValueChange={(v) => updateModelConfigMutation.mutate({ ...config, provider: v, modelId: (isEmbeddingsTask ? PROVIDER_INFO[v]?.embeddingModels?.[0] : PROVIDER_INFO[v]?.models?.[0]) || "gpt-4o-mini", taskType, isDefault: true })}>
                              <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Select provider" />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(PROVIDER_INFO).map(([key, info]) => {
                                  if (isEmbeddingsTask && !info.capabilities.includes("embeddings")) return null
                                  return <SelectItem key={key} value={key}>{info.name}</SelectItem>
                                })}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select value={config?.modelId || ""} onValueChange={(v) => updateModelConfigMutation.mutate({ ...config, modelId: v, taskType, isDefault: true })}>
                              <SelectTrigger className="w-[250px]">
                                <SelectValue placeholder="Select model" />
                              </SelectTrigger>
                              <SelectContent>
                                {config?.provider && getModelsForProvider(config.provider).map((m: string) => (
                                  <SelectItem key={m} value={m}>{m}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={!!config?.isDefault}
                              onChange={(e) => updateModelConfigMutation.mutate({ ...config, isDefault: e.target.checked, taskType })}
                              className="h-4 w-4 rounded border-primary"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => updateModelConfigMutation.mutate({ ...config, taskType, isDefault: true })}>
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Available Models by Provider
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Object.entries(PROVIDER_INFO).map(([provider, info]) => (
                  <Card key={provider}>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        {info.icon}
                        <CardTitle>{info.name}</CardTitle>
                      </div>
                      <CardDescription>
                        Capabilities: {info.capabilities.join(", ")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {info.models.map((model: string) => (
                          <Badge key={model} variant="outline">{model}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Model Discovery Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5" />
                    Discover Models
                  </CardTitle>
                  <CardDescription>
                    Fetch live models from your provider's API using your credentials. Supports pagination and task-type filtering.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Select value={discoverProvider} onValueChange={setDiscoverProvider}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PROVIDER_INFO)
                        .filter(([, info]) => info.capabilities.length > 0)
                        .map(([key, info]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              {info.icon}
                              <span>{info.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Credential</Label>
                  <Select value={discoverCredentialId} onValueChange={setDiscoverCredentialId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select credential (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Use default/env</SelectItem>
                      {credentials
                        .filter((c: AICredential) => c.provider === discoverProvider && c.isActive)
                        .map((c: AICredential) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.providerName || c.provider} {c.isDefault && <span className="ml-2 text-xs text-muted-foreground">(default)</span>}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Task Type Filter</Label>
                  <Select value={discoverTaskType} onValueChange={setDiscoverTaskType}>
                    <SelectTrigger>
                      <SelectValue placeholder="All tasks" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All</SelectItem>
                      <SelectItem value="chat">Chat</SelectItem>
                      <SelectItem value="embeddings">Embeddings</SelectItem>
                      <SelectItem value="reasoning">Reasoning</SelectItem>
                      <SelectItem value="vision">Vision</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>&nbsp;</Label>
                  <div className="flex gap-2">
                    <Button onClick={() => handleDiscoverModels(false)} disabled={isDiscovering || !discoverProvider} className="flex-1">
                      {isDiscovering ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Discovering...
                        </>
                      ) : (
                        <>
                          <Search className="mr-2 h-4 w-4" />
                          Discover
                        </>
                      )}
                    </Button>
                    <Button variant="outline" onClick={() => handleDiscoverModels(true)} disabled={isDiscovering || !discoverProvider} title="Force refresh (bypass cache)">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {discoverError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  <AlertCircle className="mr-2 h-4 w-4 inline" />
                  {discoverError}
                </div>
              )}

              {discoveredModels.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        Found {discoveredModels.length} model{discoveredModels.length !== 1 ? 's' : ''}
                      </span>
                      {discoverCached && (
                        <Badge variant="secondary" className="gap-1">
                          <Cloud className="h-3 w-3" />
                          Cached
                        </Badge>
                      )}
                      <Badge variant="outline" className="gap-1">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(new Date().toISOString())}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleSelectAllModels(true)} disabled={selectedModels.size === discoveredModels.length}>
                        Select All
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleSelectAllModels(false)} disabled={selectedModels.size === 0}>
                        Clear
                      </Button>
                      <Button onClick={handleSaveSelectedModels} disabled={selectedModels.size === 0} size="sm">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Save Selected ({selectedModels.size})
                      </Button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">Select</TableHead>
                          <TableHead>Model ID</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Capabilities</TableHead>
                          <TableHead>Context Window</TableHead>
                          <TableHead>Max Output</TableHead>
                          <TableHead>Deprecation</TableHead>
                          <TableHead className="w-80">Test</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {discoveredModels.map((model: DiscoveredModel) => (
                          <TableRow key={model.id}>
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={selectedModels.has(model.id)}
                                onChange={(e) => handleToggleModel(model.id, e.target.checked)}
                                className="h-4 w-4 rounded border-primary"
                              />
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {model.id}
                              {model.isCustom && <Badge variant="secondary" className="ml-2 text-xs">Custom</Badge>}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(model.testStatus)}
                            </TableCell>
                            <TableCell>
                              {getCapabilitiesDisplay(model)}
                            </TableCell>
                            <TableCell className="text-sm">
                              {model.contextWindow ? `${(model.contextWindow / 1000).toFixed(0)}k` : '—'}
                            </TableCell>
                            <TableCell className="text-sm">
                              {model.maxOutputTokens ? `${(model.maxOutputTokens / 1000).toFixed(0)}k` : '—'}
                            </TableCell>
                            <TableCell>
                              {getDeprecationBadge(model)}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {(['chat', 'embeddings', 'vision', 'reasoning', 'structured', 'function-calling'] as ValidationTaskType[]).map((taskType) => {
                                  const isSupported = model.capabilities?.includes(taskType)
                                  // Check confirmed using AITaskType
                                  const confirmedTask = taskType === 'function-calling' ? 'chat' : taskType
                                  const isConfirmed = model.confirmedTasks?.includes(confirmedTask as 'chat' | 'embeddings' | 'reasoning' | 'vision' | 'structured' | 'summarization')
                                  if (!isSupported && !isConfirmed) return null
                                  
                                  return (
                                    <Button
                                      key={taskType}
                                      variant={isConfirmed ? 'default' : (model.testStatus === 'testing' ? 'secondary' : 'outline')}
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => handleTestDiscoveredModel(model.id, taskType)}
                                      disabled={model.testStatus === 'testing' || model.testStatus === 'unavailable'}
                                      title={`${TASK_TYPE_LABELS[taskType]} ${isConfirmed ? '✓' : 'Test'}`}
                                    >
                                      {TASK_TYPE_ICONS[taskType]}
                                      {model.testStatus === 'testing' && (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      )}
                                    </Button>
                                  )
                                })}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Custom Model Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlusCircle className="h-5 w-5" />
                Custom Model ID
              </CardTitle>
              <CardDescription>
                Manually enter a model ID not yet in the catalogue (e.g., newly released or fine-tuned models).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Select value={customProvider} onValueChange={setCustomProvider}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PROVIDER_INFO).map(([key, info]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            {info.icon}
                            <span>{info.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Model ID</Label>
                  <Input
                    value={customModelId}
                    onChange={e => setCustomModelId(e.target.value)}
                    placeholder="e.g., gpt-4o-2024-11-20, my-fine-tuned-model"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Task Type</Label>
                  <Select value={customTaskType} onValueChange={(v: string) => setCustomTaskType(v as ValidationTaskType)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select task" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="chat">Chat</SelectItem>
                      <SelectItem value="embeddings">Embeddings</SelectItem>
                      <SelectItem value="vision">Vision</SelectItem>
                      <SelectItem value="reasoning">Reasoning</SelectItem>
                      <SelectItem value="structured">Structured Output</SelectItem>
                      <SelectItem value="function-calling">Function Calling</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleTestCustomModel} disabled={isTestingCustom || !customProvider || !customModelId || !customTaskType}>
                  {isTestingCustom ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <TestTube className="mr-2 h-4 w-4" />
                      Test Model
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={handleSaveCustomModel} disabled={!customProvider || !customModelId || !customTaskType}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Save Custom Model
                </Button>
              </div>

              {customTestResult && (
                <div className={cn("p-4 rounded-lg", customTestResult.valid ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200")}>
                  <div className="flex items-center gap-2">
                    {customTestResult.valid ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    )}
                    <span className="font-medium">
                      {customTestResult.valid ? "Model Validated" : "Validation Failed"}
                    </span>
                  </div>
                  {customTestResult.error && (
                    <p className="mt-2 text-sm text-red-600">Error: {customTestResult.error}</p>
                  )}
                  {customTestResult.testDetails && (
                    <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto">
                      {JSON.stringify(customTestResult.testDetails, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Test Tab */}
        <TabsContent value="test" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="h-5 w-5" />
                Test Provider Connection
              </CardTitle>
              <CardDescription>
                Verify your API keys work correctly before saving them.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Select value={testingProvider} onValueChange={setTestingProvider}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PROVIDER_INFO).map(([key, info]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            {info.icon}
                            <span>{info.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Model (Optional)</Label>
                  {/* Model selection with discovered models */}
                  <Select value={testModel} onValueChange={setTestModel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Auto-select" />
                    </SelectTrigger>
                    <SelectContent>
                      {testingProvider && [
                        ...(PROVIDER_INFO[testingProvider]?.models || []),
                        ...(PROVIDER_INFO[testingProvider]?.embeddingModels || []),
                        ...discoveredModels.filter((m: DiscoveredModel) => m.provider === testingProvider).map((m: DiscoveredModel) => m.id)
                      ].filter(Boolean).map((model: string) => (
                        <SelectItem key={model} value={model}>{model}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <div className="relative">
                    <Input
                      type="password"
                      value={testApiKey}
                      onChange={e => setTestApiKey(e.target.value)}
                      placeholder="Enter API key to test"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-2.5 h-8 w-8"
                      onClick={() => setTestApiKey("")}
                    >
                      <EyeOff className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Test Query</Label>
                <Textarea
                  value={testQuery}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTestQuery(e.target.value)}
                  placeholder="Enter a test message..."
                  rows={3}
                />
              </div>

              <div className="grid gap-2">
                <Button
                  onClick={handleTestConnection}
                  disabled={isTesting || !testingProvider || (!testApiKey && !credentials.some((c: AICredential) => c.provider === testingProvider && c.isActive))}
                  className="w-full"
                  size="lg"
                >
                  {isTesting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Testing Connection...
                    </>
                  ) : (
                    <>
                      <Wifi className="mr-2 h-5 w-5" />
                      Test Connection (Form Input)
                    </>
                  )}
                </Button>

                {credentials.some((c: AICredential) => c.provider === testingProvider && c.isActive) && (
                  <Button
                    onClick={() => handleTestConnection(true)}
                    disabled={isTesting}
                    className="w-full"
                    size="lg"
                    variant="outline"
                  >
                    {isTesting ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Testing Saved Config...
                      </>
                    ) : (
                      <>
                        <Wifi className="mr-2 h-5 w-5" />
                        Test Saved Configuration
                      </>
                    )}
                  </Button>
                )}
              </div>

              {testResult && (
                <div className={cn("p-4 rounded-lg", testResult.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200")}>
                  <div className="flex items-center gap-2">
                    {testResult.success ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    )}
                    <span className="font-medium">
                      {testResult.success ? "Connection Successful" : "Connection Failed"}
                    </span>
                  </div>
                  {testResult.response && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Response: {testResult.response.slice(0, 200)}{testResult.response.length > 200 ? "..." : ""}
                    </p>
                  )}
                  {testResult.error && (
                    <p className="mt-2 text-sm text-red-600">Error: {testResult.error}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wifi className="h-5 w-5" />
                Quick Provider Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Configured</TableHead>
                    <TableHead>Default Model</TableHead>
                    <TableHead>Capabilities</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(PROVIDER_INFO).map(([provider, info]) => {
                    const cred = credentials.find((c: AICredential) => c.provider === provider)
                    const config = modelConfigs.find((c: AIModelConfig) => c.provider === provider && c.isDefault)
                    return (
                      <TableRow key={provider}>
                        <TableCell className="flex items-center gap-2">
                          {info.icon}
                          <span>{info.name}</span>
                        </TableCell>
                        <TableCell>
                          {cred ? (
                            <Badge variant={cred.isActive ? "default" : "secondary"}>
                              {cred.isActive ? "Yes" : "Inactive"}
                            </Badge>
                          ) : (
                            <Badge variant="outline">Not configured</Badge>
                          )}
                        </TableCell>
                        <TableCell>{config?.modelId || "Not set"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {info.capabilities.map((cap: string) => (
                              <Badge key={cap} variant="secondary" className="text-xs">{cap}</Badge>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function AddCredentialForm({ onSuccess }: { onSuccess: () => void }) {
  const [provider, setProvider] = useState("")
  const [providerName, setProviderName] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [models, setModels] = useState<string[]>([])
  const [isDefault, setIsDefault] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const resetForm = () => {
    setProvider("")
    setProviderName("")
    setApiKey("")
    setModels([])
    setIsDefault(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!provider || !apiKey) {
      toast({ title: "Error", description: "Provider and API key are required", variant: "destructive" })
      return
    }
    setIsLoading(true)
    try {
      const response = await fetch("/api/ai/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, providerName: providerName || provider, apiKey, models, isDefault }),
      })
      if (!response.ok) {
        const result = await response.json().catch(() => null)
        throw new Error(result?.error || "Failed to add credential")
      }
      toast({ title: "Credential added successfully" })
      onSuccess()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add credential",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Provider</Label>
        <Select value={provider} onValueChange={setProvider}>
          <SelectTrigger>
            <SelectValue placeholder="Select provider" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PROVIDER_INFO).map(([key, info]) => (
              <SelectItem key={key} value={key}>
                <div className="flex items-center gap-2">
                  {info.icon}
                  <span>{info.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Custom Name (Optional)</Label>
        <Input
          value={providerName}
          onChange={e => setProviderName(e.target.value)}
          placeholder="e.g., My OpenAI Key"
        />
      </div>

      <div className="space-y-2">
        <Label>API Key</Label>
        <Input
          type="password"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          placeholder="Enter your API key"
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Models (Optional - comma separated)</Label>
        <Input
          value={models.join(", ")}
          onChange={e => setModels(e.target.value.split(",").map(m => m.trim()).filter(Boolean))}
          placeholder="e.g., gpt-4o, gpt-4o-mini"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={e => setIsDefault(e.target.checked)}
          className="h-4 w-4 rounded border-primary"
          id="isDefault"
        />
        <Label htmlFor="isDefault">Set as default for this provider</Label>
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Add Credential
        </Button>
      </div>
    </form>
  )
}
