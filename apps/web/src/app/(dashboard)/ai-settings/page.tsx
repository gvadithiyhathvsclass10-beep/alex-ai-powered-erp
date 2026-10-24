"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, Bot, Check, CheckCircle2, ChevronDown, ExternalLink,
  Eye, EyeOff, KeyRound, Loader2, RefreshCw, Search, ShieldCheck,
  Sparkles, Trash2, Unplug, WandSparkles, XCircle,
} from "lucide-react"

type Provider = {
  id: string
  name: string
  description: string
  defaultModel: string
  keyUrl: string
}
type Credential = {
  id: string
  provider: string
  providerName: string
  isActive: boolean
  isDefault: boolean
  models?: string[]
}
type Model = { id: string; name?: string; isDeprecated?: boolean; capabilities?: string[]; contextWindow?: number }

const PROVIDERS: Provider[] = [
  { id: "OPENAI", name: "OpenAI", description: "GPT models", defaultModel: "gpt-4o-mini", keyUrl: "https://platform.openai.com/api-keys" },
  { id: "GOOGLE_GEMINI", name: "Google Gemini", description: "Gemini models", defaultModel: "gemini-2.5-flash", keyUrl: "https://aistudio.google.com/apikey" },
  { id: "ANTHROPIC", name: "Anthropic", description: "Claude models", defaultModel: "claude-sonnet-4-5", keyUrl: "https://console.anthropic.com/settings/keys" },
  { id: "NVIDIA_NEMOTRON", name: "NVIDIA", description: "NVIDIA API Catalog", defaultModel: "nvidia/nemotron-3-ultra", keyUrl: "https://build.nvidia.com/" },
  { id: "GROQ", name: "Groq", description: "Fast inference", defaultModel: "llama-3.3-70b-versatile", keyUrl: "https://console.groq.com/keys" },
  { id: "MISTRAL", name: "Mistral AI", description: "Mistral models", defaultModel: "mistral-large-latest", keyUrl: "https://console.mistral.ai/api-keys/" },
  { id: "OPENROUTER", name: "OpenRouter", description: "Many model providers", defaultModel: "openrouter/auto", keyUrl: "https://openrouter.ai/keys" },
  { id: "TOGETHER_AI", name: "Together AI", description: "Open models", defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo", keyUrl: "https://api.together.ai/settings/api-keys" },
  { id: "OTHER", name: "Compatible API", description: "Other supported providers", defaultModel: "", keyUrl: "" },
]

export default function AISettingsPage() {
  const router = useRouter()
  const [providerId, setProviderId] = React.useState("GOOGLE_GEMINI")
  const [apiKey, setApiKey] = React.useState("")
  const [showKey, setShowKey] = React.useState(false)
  const [credentials, setCredentials] = React.useState<Credential[]>([])
  const [models, setModels] = React.useState<Model[]>([])
  const [modelId, setModelId] = React.useState("")
  const [modelSearch, setModelSearch] = React.useState("")
  const [customModel, setCustomModel] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [loadingModels, setLoadingModels] = React.useState(false)
  const [savingModel, setSavingModel] = React.useState(false)
  const [message, setMessage] = React.useState<{ type: "success" | "error" | "info"; text: string } | null>(null)
  const [connectedCredentialId, setConnectedCredentialId] = React.useState("")

  const provider = PROVIDERS.find((item) => item.id === providerId) || PROVIDERS[0]
  const connectedForProvider = credentials.find((item) => item.provider === providerId && item.isActive)
  const filteredModels = models.filter((model) => !model.isDeprecated && `${model.name || ""} ${model.id}`.toLowerCase().includes(modelSearch.toLowerCase()))

  const loadCredentials = React.useCallback(async () => {
    try {
      const response = await fetch("/api/ai/credentials")
      if (response.ok) {
        const data = await response.json()
        const list = Array.isArray(data) ? data : []
        setCredentials(list)
        const active = list.find((item: Credential) => item.isDefault && item.isActive) || list.find((item: Credential) => item.isActive)
        if (active) {
          setConnectedCredentialId(active.id)
          setProviderId(active.provider)
        }
      }
    } catch { /* Keep the setup screen usable when the initial request fails. */ }
  }, [])

  React.useEffect(() => { void loadCredentials() }, [loadCredentials])

  const discoverModels = async (credentialId: string, forceRefresh = false) => {
    setLoadingModels(true)
    try {
      const params = new URLSearchParams({ provider: providerId, credentialId })
      if (forceRefresh) params.set("refresh", "true")
      const response = await fetch(`/api/ai/models/discover?${params.toString()}`)
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Could not load models")
      const discovered: Model[] = Array.isArray(data.models) ? data.models : []
      setModels(discovered)
      const firstUsable = discovered.find((model) => !model.isDeprecated && (!model.capabilities?.length || model.capabilities.includes("chat")))
      if (firstUsable) {
        setModelId((current) => current && discovered.some((model) => model.id === current) ? current : firstUsable.id)
        setMessage({ type: "success", text: `Loaded ${discovered.length} models from ${provider.name}.` })
      } else {
        setMessage({ type: "info", text: "No live model list was returned. Enter a model ID supported by your provider." })
      }
      return discovered
    } catch (error) {
      setModels([])
      setMessage({ type: "info", text: error instanceof Error ? `${error.message}. You can still enter a model ID manually.` : "Model discovery failed. You can enter a model ID manually." })
      return []
    } finally { setLoadingModels(false) }
  }


  // Existing credentials must populate the model list too; discovery previously ran
  // only immediately after saving a brand-new key, leaving this selector blank on return.
  React.useEffect(() => {
    if (!connectedCredentialId || loadingModels || models.length > 0) return
    void discoverModels(connectedCredentialId)
    // Discovery is intentionally triggered only when the selected provider/credential changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectedCredentialId, providerId])

  const connectProvider = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!apiKey.trim()) {
      setMessage({ type: "error", text: "Paste your API key first." })
      return
    }
    setLoading(true)
    setMessage(null)
    try {
      const response = await fetch("/api/ai/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: providerId, providerName: provider.name, apiKey: apiKey.trim(), isDefault: true }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Could not save this API key")
      const credentialId = data.id
      setApiKey("")
      setShowKey(false)
      setConnectedCredentialId(credentialId || "")
      await loadCredentials()
      setMessage({ type: "success", text: `${provider.name} key saved securely. Finding available models…` })
      if (credentialId) {
        const found = await discoverModels(credentialId)
        const first = found.find((model) => !model.isDeprecated && (!model.capabilities?.length || model.capabilities.includes("chat")))
        if (first) await saveModel(first.id)
      }
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Connection failed" })
    } finally { setLoading(false) }
  }

  const saveModel = async (requestedModel = modelId) => {
    const chosenModel = requestedModel.trim()
    if (!chosenModel) {
      setMessage({ type: "error", text: "Choose a model or enter a model ID." })
      return
    }
    setSavingModel(true)
    try {
      const response = await fetch("/api/ai/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: providerId, modelId: chosenModel, taskType: "chat", isDefault: true, isCustom: true }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Could not save the model")
      setModelId(chosenModel)
      setCustomModel("")
      setMessage({ type: "success", text: `${chosenModel} is now your default chat model.` })
      await loadCredentials()
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Could not save the model" })
    } finally { setSavingModel(false) }
  }

  const removeCredential = async (credential: Credential) => {
    if (!window.confirm(`Disconnect ${credential.providerName}?`)) return
    try {
      const response = await fetch(`/api/ai/credentials/${credential.id}`, { method: "DELETE" })
      if (!response.ok) throw new Error("Could not disconnect provider")
      setCredentials((current) => current.filter((item) => item.id !== credential.id))
      if (connectedCredentialId === credential.id) setConnectedCredentialId("")
      setMessage({ type: "success", text: `${credential.providerName} disconnected.` })
    } catch (error) { setMessage({ type: "error", text: error instanceof Error ? error.message : "Disconnect failed" }) }
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl space-y-6 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <button onClick={() => router.push("/dashboard/assistant")} className="mt-1 rounded-xl border border-border p-2 text-muted-foreground transition hover:bg-muted" aria-label="Back to assistant"><ArrowLeft className="h-4 w-4" /></button>
          <div>
            <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-cyan-500" /><h1 className="text-2xl font-semibold tracking-tight">AI Setup</h1></div>
            <p className="mt-1 text-sm text-muted-foreground">Connect a provider, choose a model, and get back to work.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-emerald-500" /> API keys stay encrypted</div>
      </div>

      {message && <div role="status" className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${message.type === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : message.type === "error" ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300" : "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300"}`}>{message.type === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : message.type === "error" ? <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <WandSparkles className="mt-0.5 h-4 w-4 shrink-0" />}<span>{message.text}</span></div>}

      <section className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border p-5 sm:p-6"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600"><KeyRound className="h-5 w-5" /></div><div><h2 className="font-semibold">Connect an AI provider</h2><p className="text-sm text-muted-foreground">Paste your key once. We’ll load the models available to it.</p></div></div></div>
        <form onSubmit={connectProvider} className="space-y-5 p-5 sm:p-6">
          <div className="space-y-2"><label htmlFor="provider" className="text-sm font-medium">Provider</label><div className="relative"><select id="provider" value={providerId} onChange={(event) => { const nextProvider = event.target.value; setProviderId(nextProvider); setConnectedCredentialId(credentials.find((item) => item.provider === nextProvider && item.isActive)?.id || ""); setModels([]); setModelId(""); setMessage(null) }} className="h-12 w-full appearance-none rounded-xl border border-input bg-background px-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-cyan-500">{PROVIDERS.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.description}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-4 h-4 w-4 text-muted-foreground" /></div>{provider.keyUrl && <a href={provider.keyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-cyan-600 hover:underline">Get an API key from {provider.name}<ExternalLink className="h-3 w-3" /></a>}</div>
          <div className="space-y-2"><label htmlFor="api-key" className="text-sm font-medium">API key</label><div className="flex gap-2"><div className="relative flex-1"><input id="api-key" autoComplete="off" spellCheck={false} type={showKey ? "text" : "password"} value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Paste your API key here" className="h-12 w-full rounded-xl border border-input bg-background px-3 pr-11 text-sm outline-none focus:ring-2 focus:ring-cyan-500"/><button type="button" onClick={() => setShowKey((value) => !value)} className="absolute right-3 top-3.5 text-muted-foreground hover:text-foreground" aria-label={showKey ? "Hide API key" : "Show API key"}>{showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div><button type="submit" disabled={loading || !apiKey.trim()} className="inline-flex h-12 min-w-32 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}{loading ? "Connecting…" : "Connect"}</button></div><p className="text-xs text-muted-foreground">Your key is sent to the authenticated server over HTTPS and is never shown again after saving.</p></div>
        </form>
      </section>

      <section className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5 sm:p-6"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600"><Bot className="h-5 w-5" /></div><div><h2 className="font-semibold">Choose your chat model</h2><p className="text-sm text-muted-foreground">Search discovered models or enter a model ID.</p></div></div><button type="button" disabled={loadingModels || !(connectedCredentialId || connectedForProvider?.id)} onClick={() => void discoverModels(connectedCredentialId || connectedForProvider!.id, true)} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-muted disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loadingModels ? "animate-spin" : ""}`} /> Refresh models</button></div>
        <div className="space-y-4 p-5 sm:p-6">
          {!connectedForProvider && !connectedCredentialId ? <div className="rounded-xl border border-dashed border-border p-5 text-center"><Bot className="mx-auto mb-2 h-7 w-7 text-muted-foreground"/><p className="text-sm font-medium">Connect {provider.name} first</p><p className="mt-1 text-xs text-muted-foreground">After connecting, available models will appear here automatically.</p></div> : <>
            <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><input value={modelSearch} onChange={(event) => setModelSearch(event.target.value)} placeholder="Search models…" className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-cyan-500"/></div>
            {loadingModels ? <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Loading models…</div> : filteredModels.length > 0 ? <div className="max-h-64 space-y-2 overflow-y-auto pr-1">{filteredModels.map((model) => <button type="button" key={model.id} onClick={() => setModelId(model.id)} className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition ${modelId === model.id ? "border-cyan-500 bg-cyan-500/5 ring-1 ring-cyan-500/30" : "border-border hover:bg-muted/60"}`}><span className="min-w-0"><span className="block truncate text-sm font-medium">{model.name || model.id}</span><span className="block truncate text-xs text-muted-foreground">{model.id}{model.contextWindow ? ` · ${(model.contextWindow / 1000).toFixed(0)}k context` : ""}</span></span>{modelId === model.id ? <Check className="h-4 w-4 shrink-0 text-cyan-600"/> : <span className="h-4 w-4 shrink-0 rounded-full border border-border"/>}</button>)}</div> : <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">No discovered models to show. Enter the exact model ID provided by your AI provider below.</p>}
            <div className="space-y-2"><label htmlFor="custom-model" className="text-sm font-medium">Or enter a model ID</label><div className="flex flex-col gap-2 sm:flex-row"><input id="custom-model" value={customModel} onChange={(event) => setCustomModel(event.target.value)} placeholder={provider.defaultModel || "provider/model-name"} className="h-10 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-cyan-500"/><button type="button" onClick={() => { if (customModel.trim()) { setModelId(customModel.trim()); void saveModel(customModel.trim()) } }} disabled={!customModel.trim() || savingModel} className="h-10 rounded-xl border border-border px-4 text-sm font-medium hover:bg-muted disabled:opacity-50">Use this ID</button></div></div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"><div className="min-w-0"><p className="text-xs text-muted-foreground">Selected model</p><p className="max-w-full break-all text-sm font-medium">{modelId || "No model selected"}</p></div><button type="button" onClick={() => void saveModel()} disabled={!modelId || savingModel} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:opacity-50">{savingModel ? <Loader2 className="h-4 w-4 animate-spin"/> : <CheckCircle2 className="h-4 w-4"/>}Save model</button></div>
          </>}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border p-5"><div><h2 className="font-semibold">Connected providers</h2><p className="text-sm text-muted-foreground">Manage saved credentials.</p></div><button onClick={() => void loadCredentials()} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Reload providers"><RefreshCw className="h-4 w-4"/></button></div>
        <div className="divide-y divide-border">{credentials.length ? credentials.map((credential) => <div key={credential.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="flex min-w-0 items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600"><CheckCircle2 className="h-5 w-5"/></div><div className="min-w-0"><p className="truncate text-sm font-medium">{credential.providerName}</p><p className="text-xs text-muted-foreground">{credential.isDefault ? "Default provider" : "Connected"} · API key hidden</p></div></div><button onClick={() => void removeCredential(credential)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-muted-foreground transition hover:bg-red-500/10 hover:text-red-600"><Trash2 className="h-3.5 w-3.5"/>Disconnect</button></div>) : <div className="p-6 text-center text-sm text-muted-foreground"><Unplug className="mx-auto mb-2 h-5 w-5"/>No providers connected yet.</div>}</div>
      </section>
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
        <p className="font-medium">Document upload needs an embeddings provider</p>
        <p className="mt-1 text-muted-foreground">Some chat providers (including NVIDIA and Groq in this app) do not provide document embeddings. For upload, indexing and document search, also connect an OpenAI, Google Gemini, or Mistral API key. Your chat model can remain unchanged.</p>
      </div>
      <p className="text-center text-xs text-muted-foreground">Model availability, pricing and access depend on your provider account and API key.</p>
    </div>
  )
}
