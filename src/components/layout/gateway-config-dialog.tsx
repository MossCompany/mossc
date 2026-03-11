"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Eye, EyeOff, Loader2, PlugZap } from "lucide-react"
import { toast } from "sonner"

import { useI18n } from "@/i18n"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"

type StudioGatewaySettings = {
  url: string
  token: string
}

type StudioSettingsResponse = {
  settings?: {
    gateway?: StudioGatewaySettings | null
  }
  gatewayMeta?: {
    hasStoredToken?: boolean
  }
  domainApiModeEnabled?: boolean
  runtimeReconnect?: {
    attempted: boolean
    restarted: boolean
    reason?: string
    previousStatus?: string
    error?: string
  } | null
  error?: string
}

const readString = (value: unknown): string => (typeof value === "string" ? value.trim() : "")

export function GatewayConfigDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useI18n()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  const [gatewayUrl, setGatewayUrl] = useState("")
  const [tokenDraft, setTokenDraft] = useState("")
  const [showToken, setShowToken] = useState(false)

  const [hasStoredToken, setHasStoredToken] = useState(false)
  const [domainApiModeEnabled, setDomainApiModeEnabled] = useState(true)

  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)
  const [lastReconnectNote, setLastReconnectNote] = useState<string | null>(null)

  const tokenHelper = useMemo(() => {
    if (hasStoredToken) return t("gatewayConfig.tokenStoredHint")
    return t("gatewayConfig.tokenRequiredHint")
  }, [hasStoredToken, t])

  const load = useCallback(async () => {
    setLoading(true)
    setLastError(null)
    setLastReconnectNote(null)
    try {
      const res = await fetch("/api/studio")
      const data = (await res.json()) as StudioSettingsResponse
      if (!res.ok || data.error) {
        setLastError(data.error || t("gatewayConfig.loadFailed"))
        return
      }

      setGatewayUrl(readString(data.settings?.gateway?.url))
      setHasStoredToken(Boolean(data.gatewayMeta?.hasStoredToken))
      setDomainApiModeEnabled(data.domainApiModeEnabled !== false)
      // Never prefill token; keep draft empty.
      setTokenDraft("")
    } catch (err) {
      setLastError(String(err))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (!open) return
    void load()
  }, [open, load])

  const validateForTestOrSave = () => {
    const url = gatewayUrl.trim()
    if (!url) {
      toast.error(t("gatewayConfig.urlRequired"))
      return null
    }
    const token = tokenDraft.trim()
    if (!token && !hasStoredToken) {
      toast.error(t("gatewayConfig.tokenRequired"))
      return null
    }
    return { url, token }
  }

  const handleTest = async () => {
    const validated = validateForTestOrSave()
    if (!validated) return

    setTesting(true)
    setLastError(null)
    setLastCheckedAt(null)
    try {
      const body: Record<string, unknown> = {
        gateway: { url: validated.url } as Record<string, unknown>,
        useStoredToken: true,
      }
      if (validated.token) {
        ;(body.gateway as Record<string, unknown>).token = validated.token
      }

      const res = await fetch("/api/studio/test-connection", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string; checkedAt?: string }
      if (!res.ok || !data.ok) {
        const message = data.error || t("gatewayConfig.testFailed")
        setLastError(message)
        toast.error(message)
        return
      }

      setLastCheckedAt(data.checkedAt ?? new Date().toISOString())
      toast.success(t("gatewayConfig.testSuccess"))
    } catch (err) {
      const message = String(err)
      setLastError(message)
      toast.error(message)
    } finally {
      setTesting(false)
    }
  }

  const formatReconnectNote = (meta: StudioSettingsResponse["runtimeReconnect"]) => {
    if (!meta) return null
    if (!meta.attempted) {
      return meta.reason
        ? t("gatewayConfig.reconnect.notAttempted", { reason: meta.reason })
        : t("gatewayConfig.reconnect.notAttempted", { reason: "unknown" })
    }
    if (meta.restarted) {
      return t("gatewayConfig.reconnect.restarted", {
        previousStatus: meta.previousStatus ?? "unknown",
      })
    }
    if (meta.error) {
      return t("gatewayConfig.reconnect.failed", { error: meta.error })
    }
    return t("gatewayConfig.reconnect.failed", { error: "unknown" })
  }

  const handleSave = async () => {
    const validated = validateForTestOrSave()
    if (!validated) return

    setSaving(true)
    setLastError(null)
    setLastReconnectNote(null)
    try {
      const patch: Record<string, unknown> = {
        gateway: { url: validated.url } as Record<string, unknown>,
      }
      // IMPORTANT: only include token when user provided one.
      if (validated.token) {
        ;(patch.gateway as Record<string, unknown>).token = validated.token
      }

      const res = await fetch("/api/studio", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      })
      const data = (await res.json()) as StudioSettingsResponse
      if (!res.ok || data.error) {
        const message = data.error || t("gatewayConfig.saveFailed")
        setLastError(message)
        toast.error(message)
        return
      }

      setHasStoredToken(Boolean(data.gatewayMeta?.hasStoredToken))
      setDomainApiModeEnabled(data.domainApiModeEnabled !== false)

      const reconnectNote = formatReconnectNote(data.runtimeReconnect ?? null)
      if (reconnectNote) setLastReconnectNote(reconnectNote)

      toast.success(t("gatewayConfig.saveSuccess"))

      // Refresh local state (especially if token got stored via openclaw.json defaults path)
      void load()
    } catch (err) {
      const message = String(err)
      setLastError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] !max-w-[640px] gap-0 p-0 overflow-hidden">
        <div className="p-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlugZap className="h-4 w-4" />
              {t("gatewayConfig.title")}
            </DialogTitle>
            <DialogDescription>
              {t("gatewayConfig.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {!domainApiModeEnabled && (
              <div className="rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                {t("gatewayConfig.domainApiModeDisabled")}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {t("gatewayConfig.urlLabel")}
              </label>
              <Input
                className="text-sm font-mono"
                placeholder={t("gatewayConfig.urlPlaceholder")}
                value={gatewayUrl}
                onChange={(e) => setGatewayUrl(e.target.value)}
                disabled={loading || saving}
              />
              <div className="text-xs text-muted-foreground">
                {t("gatewayConfig.urlHint")}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {t("gatewayConfig.tokenLabel")}
              </label>
              <div className="flex items-center gap-1.5">
                <Input
                  className="text-sm flex-1 font-mono"
                  type={showToken ? "text" : "password"}
                  placeholder={t("gatewayConfig.tokenPlaceholder")}
                  value={tokenDraft}
                  onChange={(e) => setTokenDraft(e.target.value)}
                  disabled={loading || saving}
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setShowToken((v) => !v)}
                  disabled={loading || saving}
                >
                  {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">{tokenHelper}</div>
              <div className="text-xs text-muted-foreground">
                {t("gatewayConfig.tokenStoredState", { state: hasStoredToken ? "stored" : "missing" })}
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              {lastCheckedAt ? (
                <div className="text-xs text-muted-foreground">
                  {t("gatewayConfig.lastCheckedAt", { checkedAt: lastCheckedAt })}
                </div>
              ) : null}
              {lastReconnectNote ? (
                <div className="text-xs text-muted-foreground">{lastReconnectNote}</div>
              ) : null}
              {lastError ? (
                <div className="text-xs text-destructive">{lastError}</div>
              ) : null}
            </div>
          </div>
        </div>

        <DialogFooter>
          <div className="flex w-full items-center justify-between gap-2">
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={loading || saving || testing}
            >
              {testing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t("gatewayConfig.testing")}
                </>
              ) : (
                t("gatewayConfig.test")
              )}
            </Button>

            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving || testing}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleSave} disabled={loading || saving || testing}>
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {t("gatewayConfig.saving")}
                  </>
                ) : (
                  t("common.save")
                )}
              </Button>
            </div>
          </div>

          {loading ? (
            <div className={cn("text-xs text-muted-foreground flex items-center gap-2")}
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t("gatewayConfig.loading")}
            </div>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
