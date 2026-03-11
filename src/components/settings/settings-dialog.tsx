"use client"

import { useEffect, useState } from "react"
import { ArrowLeft, Brain, Check, Languages, ShieldCheck, Users } from "lucide-react"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  LOCALE_OPTIONS,
  getLocaleLabel,
  useI18n,
  type LocalePreference,
} from "@/i18n"
import { cn } from "@/lib/utils"
import { ModelConfigPanel } from "./model-config"
import { UsersPanel } from "@/components/admin/users-panel"

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type SettingsSection = "models" | "language" | "community" | "users"

type CurrentUser = { id: string; username: string; role: "admin" | "user" }

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { t } = useI18n()
  const [activeSection, setActiveSection] = useState<SettingsSection>("models")
  const [mobileShowContent, setMobileShowContent] = useState(false)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)

  useEffect(() => {
    if (!open) return
    fetch("/api/auth/me")
      .then((r) => r.json() as Promise<CurrentUser>)
      .then((u) => setCurrentUser(u))
      .catch(() => {})
  }, [open])

  const isAdmin = currentUser?.role === "admin"

  type NavItem = { id: SettingsSection; label: string; icon: typeof Brain | typeof Languages | typeof ShieldCheck }
  const navItems: NavItem[] = [
    { id: "models", label: t("settings.sections.models"), icon: Brain },
    { id: "language", label: t("settings.sections.language"), icon: Languages },
    { id: "community", label: t("settings.sections.community"), icon: Users },
    ...(isAdmin
      ? [{ id: "users" as SettingsSection, label: t("settings.sections.users"), icon: ShieldCheck }]
      : []),
  ]

  const handleSelectSection = (id: SettingsSection) => {
    setActiveSection(id)
    setMobileShowContent(true)
  }

  const handleBack = () => {
    setMobileShowContent(false)
  }

  const activeLabel = navItems.find((n) => n.id === activeSection)?.label

  const sectionDescription = {
    models: t("settings.descriptions.models"),
    language: t("settings.descriptions.language"),
    community: t("settings.descriptions.community"),
    users: t("settings.descriptions.users"),
  }[activeSection]

  const handleOpenChange = (o: boolean) => {
    if (!o) {
      setMobileShowContent(false)
    }
    onOpenChange(o)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-full h-[100dvh] max-w-full rounded-none p-0 gap-0 overflow-hidden md:w-[80vw] md:!max-w-[1000px] md:h-[80vh] md:rounded-xl"
      >
        <div className="flex h-full overflow-hidden">
          {/* Sidebar – always visible on desktop; on mobile only shown when not in content view */}
          <nav className={cn(
            "shrink-0 border-r bg-muted/30 flex flex-col",
            "w-full md:w-48",
            mobileShowContent ? "hidden md:flex" : "flex"
          )}>
            <div className="px-3 py-3 border-b">
              <button
                onClick={() => onOpenChange(false)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {t("settings.backToApp")}
              </button>
            </div>
            <div className="flex-1 py-2 px-2 space-y-0.5">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelectSection(item.id)}
                  className={cn(
                    "flex items-center gap-2 w-full rounded-md px-2.5 py-2 text-sm transition-colors",
                    activeSection === item.id
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </button>
              ))}
            </div>
          </nav>

          {/* Content – always visible on desktop; on mobile only shown when mobileShowContent */}
          <div className={cn(
            "flex-1 min-w-0 min-h-0 flex flex-col",
            !mobileShowContent ? "hidden md:flex" : "flex"
          )}>
            <div className="px-4 py-3 border-b shrink-0 flex items-center gap-2">
              {/* Mobile back button */}
              <button
                className="md:hidden flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:bg-accent transition-colors shrink-0"
                onClick={handleBack}
                aria-label={t("common.back")}
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <h2 className="text-base font-medium">{activeLabel}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{sectionDescription}</p>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="px-4 py-4">
                {activeSection === "models" && <ModelConfigPanel />}
                {activeSection === "language" && <LanguageSettingsPanel />}
                {activeSection === "community" && <CommunityPanel />}
                {activeSection === "users" && currentUser && (
                  <UsersPanel currentUserId={currentUser.id} />
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function LanguageSettingsPanel() {
  const { locale, preference, setPreference, t } = useI18n()

  const options: Array<{
    value: LocalePreference
    label: string
    description?: string
  }> = [
    {
      value: "system",
      label: t("settings.language.system"),
      description: t("settings.language.systemDescription"),
    },
    ...LOCALE_OPTIONS.map((option) => ({
      value: option.code,
      label: option.label,
    })),
  ]

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        {t("settings.language.current")}: {getLocaleLabel(locale)}
      </div>
      <div className="space-y-2">
        {options.map((option) => {
          const active = preference === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setPreference(option.value)}
              className={cn(
                "flex w-full items-start justify-between rounded-lg border px-4 py-3 text-left transition-colors",
                active
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-accent"
              )}
            >
              <div className="space-y-1">
                <div className="text-sm font-medium text-foreground">{option.label}</div>
                {option.description && (
                  <div className="text-xs text-muted-foreground">{option.description}</div>
                )}
              </div>
              {active && (
                <div className="rounded-full bg-primary/10 p-1 text-primary">
                  <Check className="h-4 w-4" />
                </div>
              )}
            </button>
          )
        })}
      </div>
      <Button variant="outline" onClick={() => setPreference("system")}>
        {t("settings.language.system")}
      </Button>
    </div>
  )
}

function CommunityPanel() {
  const { t } = useI18n()

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-base font-semibold">{t("settings.community.title")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("settings.community.description")}
        </p>
      </div>

      <div className="flex justify-center py-6">
        <div className="flex flex-col items-center gap-4 rounded-lg border bg-muted/20 p-6 shadow-sm">
          <img
            src="https://mossc-1253302184.cos.ap-beijing.myqcloud.com/wxq.png"
            alt="WeChat QR Code"
            className="h-[280px] w-[280px] rounded bg-white object-contain p-2"
          />
          <p className="text-sm text-muted-foreground">
            {t("settings.community.qrTip")}
          </p>
        </div>
      </div>
    </div>
  )
}
