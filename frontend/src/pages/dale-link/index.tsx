import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getUsers } from "@/services/users"
import { apiFetch } from "@/lib/api"
import { useAuth } from "@/hooks/use-auth"
import type { User } from "@/types/user"

export default function DaleLinkPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>("")
  const [generating, setGenerating] = useState(false)
  const [generatedUrl, setGeneratedUrl] = useState<string>("")

  useEffect(() => {
    getUsers()
      .then((res) => setUsers(res.data.filter((u) => u.isActive)))
      .catch(() => toast.error("Failed to load users"))
  }, [])

  const handleGenerate = async () => {
    if (!selectedUserId) return
    setGenerating(true)
    setGeneratedUrl("")
    try {
      const res = await apiFetch("/api/v1/auth/dale-bootstrap-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: Number(selectedUserId) }),
      })
      const body = await res.json()
      if (!res.ok || !body.success) {
        throw new Error(body.error?.message || "Failed to generate link")
      }
      const fullUrl = `${window.location.origin}${body.path}`
      setGeneratedUrl(fullUrl)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate link")
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = async () => {
    if (!generatedUrl) return
    await navigator.clipboard.writeText(generatedUrl)
    toast.success("Link copied to clipboard")
  }

  if (!currentUser?.isAdmin) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background p-6">
        <p className="text-muted-foreground">Admin access required.</p>
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-background p-6">
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Generate Dale URL</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user-select">User</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger id="user-select">
                  <SelectValue placeholder="Pick a user…" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.firstName} {u.lastName} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={!selectedUserId || generating}
            >
              {generating ? "Generating…" : "Generate URL"}
            </Button>

            {generatedUrl && (
              <div className="space-y-2 pt-4">
                <Label htmlFor="generated-url">Bootstrap URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="generated-url"
                    readOnly
                    value={generatedUrl}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <Button variant="outline" onClick={handleCopy}>
                    Copy
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Text this URL to the user. They open it once, then "Add to
                  Home Screen" to install the PWA.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
