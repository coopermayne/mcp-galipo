import type { LoginResponse, VerifyResponse } from "@/types/auth"
import { apiFetch } from "@/lib/api"

export async function login(
  email: string,
  password: string
): Promise<LoginResponse> {
  const res = await apiFetch("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: email, password }),
  })
  return res.json()
}

export async function verifyToken(): Promise<VerifyResponse> {
  const res = await apiFetch("/api/v1/auth/verify")
  return res.json()
}

export async function logout(): Promise<void> {
  await apiFetch("/api/v1/auth/logout", { method: "POST" })
}
