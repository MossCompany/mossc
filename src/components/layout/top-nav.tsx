"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Bug, Check, ChevronDown, Loader2, Wifi, WifiOff } from "lucide-react"

import { cn } from "@/lib/utils"
import { useI18n } from "@/i18n"
import { useApp } from "@/store/app-context"
import { useConnectionSummary } from "@/hooks/use-openclaw"
import { APP_VERSION, BUG_FEEDBACK_URL } from "@/lib/app-meta"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { GatewayConfigDialog } from "./gateway-config-dialog"

const connectionColors: Record<string, string> = {
  connected: "text-green-600",
  connecting: "text-yellow-600",
  disconnected: "text-muted-foreground",
  error: "text-destructive",
}

interface TopNavProps {
  onVersionClick?: () => void
}

export function TopNav({ onVersionClick }: TopNavProps) {
  const { state } = useApp()
  const { t } = useI18n()
  const { summary, loadSummary } = useConnectionSummary()
  const [gatewayDialogOpen, setGatewayDialogOpen] = useState(false)

  const engineOptions = [
    { id: "openclaw", name: "OpenClaw", active: true },
    { id: "claude-code", name: "Claude Code", active: false },
    { id: "codex", name: "Codex", active: false },
    { id: "nanobot", name: "Nanobot", active: false },
    { id: "more", name: t("messageInput.toolbar.more"), active: false },
  ] as const

  const connStatus = (state as { connectionStatus?: string }).connectionStatus ?? "disconnected"
  const connectionLabels: Record<string, string> = {
    connected: t("topNav.connection.connected"),
    connecting: t("topNav.connection.connecting"),
    disconnected: t("topNav.connection.disconnected"),
    error: t("topNav.connection.error"),
  }
  const connInfo = {
    label: connectionLabels[connStatus] ?? connectionLabels.disconnected,
    color: connectionColors[connStatus] ?? connectionColors.disconnected,
  }
  const versionLabel = summary?.version ? `OpenClaw v${summary.version}` : null

  useEffect(() => {
    void loadSummary()
  }, [loadSummary])

  return (
    <header className="flex h-14 items-center border-b bg-background px-4 gap-4">
      <div className="flex items-center">
        <Image src="/mossclogo.png" alt="MossC" width={140} height={32} className="h-8 w-auto" priority />
      </div>

      {/* 连接状态 + 引擎选择 */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "flex items-center gap-1.5 text-xs rounded-md px-2 py-1 transition-colors hover:bg-accent/50 cursor-pointer outline-none",
            connInfo.color
          )}
        >
          {connStatus === "connecting" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : connStatus === "connected" ? (
            <Wifi className="h-3.5 w-3.5" />
          ) : (
            <WifiOff className="h-3.5 w-3.5" />
          )}
          <span>{connInfo.label}</span>
          {versionLabel ? <span className="text-muted-foreground">{versionLabel}</span> : null}
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" sideOffset={6} className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{t("topNav.selectEngine")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {engineOptions.map((engine) => (
              <DropdownMenuItem
                key={engine.id}
                disabled={!engine.active}
                className={cn(!engine.active && "opacity-50 cursor-not-allowed")}
              >
                <div className="flex items-center justify-between w-full gap-3">
                  <div className="flex items-center gap-2">
                    {engine.active ? (
                      <Check className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <span className="w-3.5" />
                    )}
                    <span>{engine.name}</span>
                  </div>
                  {!engine.active && (
                    <Badge
                      variant="secondary"
                      className="h-[18px] px-1.5 text-[10px] font-normal"
                    >
                      {t("topNav.comingSoon")}
                    </Badge>
                  )}
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuLabel>Gateway</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setGatewayDialogOpen(true)}>
              {t("topNav.gateway.configure")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <GatewayConfigDialog open={gatewayDialogOpen} onOpenChange={setGatewayDialogOpen} />

      <div className="flex-1" />

      <div className="flex items-center gap-1 shrink-0">
        <span
          role="button"
          tabIndex={0}
          className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
          onClick={onVersionClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onVersionClick?.()
          }}
        >
          v{APP_VERSION}
        </span>
        {BUG_FEEDBACK_URL ? (
          <a
            href={BUG_FEEDBACK_URL}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 text-muted-foreground")}
          >
            <Bug className="h-4 w-4" />
            <span>{t("header.bugFeedback")}</span>
          </a>
        ) : null}
      </div>
    </header>
  )
}
