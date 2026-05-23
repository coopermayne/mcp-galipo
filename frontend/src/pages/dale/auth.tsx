import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router"
import { bootstrapDaleSession } from "@/services/dale"

export default function DaleAuthPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(
    token ? null : "Missing link token. Ask the admin for a fresh link.",
  )

  useEffect(() => {
    if (!token) return

    let cancelled = false
    bootstrapDaleSession(token)
      .then((res) => {
        if (cancelled) return
        if (res.success && res.token) {
          localStorage.setItem("token", res.token)
          navigate("/dale", { replace: true })
        } else {
          setError(
            res.error?.message ??
              "This link isn't valid. Ask the admin for a new one.",
          )
        }
      })
      .catch(() => {
        if (cancelled) return
        setError("Couldn't connect. Check your internet and try again.")
      })

    return () => {
      cancelled = true
    }
  }, [token, navigate])

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm text-center">
        {error ? (
          <>
            <p className="text-2xl font-semibold">Link expired</p>
            <p className="mt-3 text-base text-muted-foreground">{error}</p>
          </>
        ) : (
          <p className="text-xl text-muted-foreground">Loading…</p>
        )}
      </div>
    </div>
  )
}
