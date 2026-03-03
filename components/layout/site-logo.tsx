"use client"

import { useEffect, useState } from "react"
import { Building2 } from "lucide-react"
import { getSettings } from "@/lib/firebase-db"

interface SiteLogoProps {
  iconClassName?: string
  textClassName?: string
}

export function SiteLogo({
  iconClassName = "h-6 w-6 text-primary",
  textClassName = "text-lg font-bold text-foreground",
}: SiteLogoProps) {
  const [siteLogoUrl, setSiteLogoUrl] = useState("")

  useEffect(() => {
    let mounted = true
    getSettings()
      .then((settings) => {
        if (mounted) setSiteLogoUrl(settings.siteLogoUrl || "")
      })
      .catch(() => {
        if (mounted) setSiteLogoUrl("")
      })
    return () => {
      mounted = false
    }
  }, [])

  return (
    <>
      {siteLogoUrl ? (
        <img
          src={siteLogoUrl}
          alt="Anga Function Hall Logo"
          className="h-6 w-6 rounded object-cover"
          onError={() => setSiteLogoUrl("")}
        />
      ) : (
        <Building2 className={iconClassName} />
      )}
      <span className={textClassName}>Anga Function Hall</span>
    </>
  )
}
