const AUTH_ENDPOINTS = ["/api/v1/auth/login", "/api/v1/auth/verify"]

export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const token = localStorage.getItem("token")

  const headers = new Headers(init?.headers)
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  const res = await fetch(input, { ...init, headers })

  if (res.status === 401) {
    const url = typeof input === "string" ? input : input.toString()
    const isAuthEndpoint = AUTH_ENDPOINTS.some((ep) => url.includes(ep))
    if (!isAuthEndpoint) {
      window.dispatchEvent(new CustomEvent("auth:logout"))
    }
  }

  return res
}
