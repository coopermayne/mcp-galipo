"""
Custom OAuth provider for MCP server authentication.

Provides password-protected OAuth 2.1 flow for Claude Desktop/Claude.ai.
Uses Dynamic Client Registration (RFC 7591) as required by Claude.
"""

import logging
import os
import secrets
import time

logger = logging.getLogger(__name__)
from urllib.parse import urlencode

from mcp.server.auth.provider import (
    AccessToken,
    AuthorizationCode,
    AuthorizationParams,
    RefreshToken,
    TokenError,
    construct_redirect_uri,
)
from mcp.shared.auth import OAuthClientInformationFull, OAuthToken
from pydantic import AnyHttpUrl
from starlette.requests import Request
from starlette.responses import HTMLResponse, RedirectResponse
from starlette.routing import Route

from fastmcp.server.auth.auth import ClientRegistrationOptions, OAuthProvider

# Token expiration times
AUTH_CODE_EXPIRY = 5 * 60  # 5 minutes
ACCESS_TOKEN_EXPIRY = 60 * 60  # 1 hour
REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60  # 7 days


class PasswordOAuthProvider(OAuthProvider):
    """
    OAuth 2.1 provider with simple password authentication.

    Claude Desktop/Claude.ai will:
    1. Discover OAuth endpoints via /.well-known/oauth-authorization-server
    2. Register as a client via /register (Dynamic Client Registration)
    3. Redirect user to /authorize
    4. User enters the password on the login form
    5. On success, user is redirected back to Claude with auth code
    6. Claude exchanges code for tokens at /token
    """

    def __init__(
        self,
        base_url: str,
        password: str,
    ):
        super().__init__(
            base_url=base_url,
            client_registration_options=ClientRegistrationOptions(
                enabled=True,
                valid_scopes=["mcp:full"],
            ),
        )
        self.password = password

        # In-memory storage
        self.clients: dict[str, OAuthClientInformationFull] = {}
        self.auth_codes: dict[str, AuthorizationCode] = {}
        self.access_tokens: dict[str, AccessToken] = {}
        self.refresh_tokens: dict[str, RefreshToken] = {}

    # --- Client Registration ---

    async def get_client(self, client_id: str) -> OAuthClientInformationFull | None:
        return self.clients.get(client_id)

    async def register_client(self, client_info: OAuthClientInformationFull) -> None:
        if client_info.client_id is None:
            raise ValueError("client_id is required")
        self.clients[client_info.client_id] = client_info
        logger.info(f"[OAuth] Registered client: {client_info.client_id}")

    # --- Authorization ---

    async def authorize(
        self, client: OAuthClientInformationFull, params: AuthorizationParams
    ) -> str:
        """
        Called after user successfully authenticates.
        Creates auth code and returns redirect URI.
        """
        if client.client_id is None:
            raise ValueError("client_id is required")

        # Create authorization code
        code = f"auth_{secrets.token_hex(16)}"
        expires_at = time.time() + AUTH_CODE_EXPIRY

        scopes = params.scopes or []
        if client.scope:
            allowed = set(client.scope.split())
            scopes = [s for s in scopes if s in allowed]

        self.auth_codes[code] = AuthorizationCode(
            code=code,
            client_id=client.client_id,
            redirect_uri=params.redirect_uri,
            redirect_uri_provided_explicitly=params.redirect_uri_provided_explicitly,
            scopes=scopes,
            expires_at=expires_at,
            code_challenge=params.code_challenge,
        )

        redirect_url = construct_redirect_uri(
            str(params.redirect_uri), code=code, state=params.state
        )
        logger.info(f"[OAuth] Created auth code for client {client.client_id}, redirecting to {redirect_url[:100]}...")
        return redirect_url

    # --- Token Exchange ---

    async def load_authorization_code(
        self, client: OAuthClientInformationFull, authorization_code: str
    ) -> AuthorizationCode | None:
        auth_code = self.auth_codes.get(authorization_code)
        if not auth_code:
            logger.warning(f"[OAuth] Auth code not found: {authorization_code[:20]}...")
            return None
        if auth_code.client_id != client.client_id:
            logger.warning(f"[OAuth] Auth code client mismatch: {auth_code.client_id} != {client.client_id}")
            return None
        if auth_code.expires_at < time.time():
            logger.warning(f"[OAuth] Auth code expired for client {client.client_id}")
            del self.auth_codes[authorization_code]
            return None
        logger.info(f"[OAuth] Auth code validated for client {client.client_id}")
        return auth_code

    async def exchange_authorization_code(
        self, client: OAuthClientInformationFull, authorization_code: AuthorizationCode
    ) -> OAuthToken:
        logger.info(f"[OAuth] Exchanging auth code for client {client.client_id}")

        # Consume the auth code
        if authorization_code.code in self.auth_codes:
            del self.auth_codes[authorization_code.code]

        if client.client_id is None:
            raise TokenError("invalid_client", "Client ID is required")

        # Create tokens
        access_token = f"access_{secrets.token_hex(32)}"
        refresh_token = f"refresh_{secrets.token_hex(32)}"

        self.access_tokens[access_token] = AccessToken(
            token=access_token,
            client_id=client.client_id,
            scopes=authorization_code.scopes,
            expires_at=int(time.time() + ACCESS_TOKEN_EXPIRY),
        )

        self.refresh_tokens[refresh_token] = RefreshToken(
            token=refresh_token,
            client_id=client.client_id,
            scopes=authorization_code.scopes,
            expires_at=int(time.time() + REFRESH_TOKEN_EXPIRY),
        )

        logger.info(f"[OAuth] Issued tokens for client {client.client_id}")
        return OAuthToken(
            access_token=access_token,
            token_type="Bearer",
            expires_in=ACCESS_TOKEN_EXPIRY,
            refresh_token=refresh_token,
            scope=" ".join(authorization_code.scopes),
        )

    # --- Token Refresh ---

    async def load_refresh_token(
        self, client: OAuthClientInformationFull, refresh_token: str
    ) -> RefreshToken | None:
        token = self.refresh_tokens.get(refresh_token)
        if not token:
            return None
        if token.client_id != client.client_id:
            return None
        if token.expires_at and token.expires_at < time.time():
            del self.refresh_tokens[refresh_token]
            return None
        return token

    async def exchange_refresh_token(
        self,
        client: OAuthClientInformationFull,
        refresh_token: RefreshToken,
        scopes: list[str],
    ) -> OAuthToken:
        if client.client_id is None:
            raise TokenError("invalid_client", "Client ID is required")

        # Validate scopes
        original_scopes = set(refresh_token.scopes)
        requested_scopes = set(scopes)
        if not requested_scopes.issubset(original_scopes):
            raise TokenError("invalid_scope", "Requested scopes exceed original grant")

        # Revoke old tokens
        if refresh_token.token in self.refresh_tokens:
            del self.refresh_tokens[refresh_token.token]

        # Create new tokens
        new_access = f"access_{secrets.token_hex(32)}"
        new_refresh = f"refresh_{secrets.token_hex(32)}"

        self.access_tokens[new_access] = AccessToken(
            token=new_access,
            client_id=client.client_id,
            scopes=scopes,
            expires_at=int(time.time() + ACCESS_TOKEN_EXPIRY),
        )

        self.refresh_tokens[new_refresh] = RefreshToken(
            token=new_refresh,
            client_id=client.client_id,
            scopes=scopes,
            expires_at=int(time.time() + REFRESH_TOKEN_EXPIRY),
        )

        return OAuthToken(
            access_token=new_access,
            token_type="Bearer",
            expires_in=ACCESS_TOKEN_EXPIRY,
            refresh_token=new_refresh,
            scope=" ".join(scopes),
        )

    # --- Token Verification ---

    async def load_access_token(self, token: str) -> AccessToken | None:
        access_token = self.access_tokens.get(token)
        if not access_token:
            logger.warning(f"[OAuth] Token not found: {token[:20]}...")
            return None
        if access_token.expires_at and access_token.expires_at < time.time():
            logger.warning(f"[OAuth] Token expired for client {access_token.client_id}")
            del self.access_tokens[token]
            return None
        return access_token

    async def verify_token(self, token: str) -> AccessToken | None:
        result = await self.load_access_token(token)
        if result:
            logger.info(f"[OAuth] Token verified for client {result.client_id}")
        return result

    async def revoke_token(self, token: AccessToken | RefreshToken) -> None:
        if isinstance(token, AccessToken) and token.token in self.access_tokens:
            del self.access_tokens[token.token]
        elif isinstance(token, RefreshToken) and token.token in self.refresh_tokens:
            del self.refresh_tokens[token.token]

    # --- Custom Login Routes ---

    def get_routes(self, mcp_path: str | None = None) -> list[Route]:
        """Add custom login routes and override authorize to require login."""
        routes = super().get_routes(mcp_path)

        # Replace the /authorize route with our custom one that redirects to login
        filtered_routes = []
        for route in routes:
            if isinstance(route, Route) and route.path == "/authorize":
                # Replace with our login-required authorize
                filtered_routes.append(
                    Route("/authorize", endpoint=self._authorize_with_login, methods=["GET"])
                )
            else:
                filtered_routes.append(route)

        # Add our login page route
        filtered_routes.append(Route("/login", endpoint=self._login_page, methods=["GET", "POST"]))

        return filtered_routes

    async def _authorize_with_login(self, request: Request):
        """
        Custom /authorize endpoint that redirects to login first.

        OAuth flow:
        1. Claude calls /authorize with client_id, redirect_uri, state, etc.
        2. We redirect to /login with all params preserved
        3. User enters password
        4. On success, /login calls the real authorize logic
        """
        # Redirect to login with all OAuth params preserved
        params = dict(request.query_params)
        return RedirectResponse(f"/login?{urlencode(params)}", status_code=302)

    async def _login_page(self, request: Request):
        """
        Custom login page for password authentication.

        GET: Show login form
        POST: Validate password and complete OAuth authorize

        Note: All OAuth params are passed through hidden form fields (stateless)
        to support multi-worker deployments where in-memory state isn't shared.
        """
        if request.method == "GET":
            # Get OAuth params from query string
            params = dict(request.query_params)
            state = params.get("state", "")
            client_id = params.get("client_id", "")
            redirect_uri = params.get("redirect_uri", "")
            scope = params.get("scope", "")
            code_challenge = params.get("code_challenge", "")
            code_challenge_method = params.get("code_challenge_method", "")

            error = params.get("error", "")
            error_html = f'<p style="color: #ef4444; margin-bottom: 16px;">{error}</p>' if error else ""

            # Pass all OAuth params as hidden fields (stateless - no server memory needed)
            return HTMLResponse(f"""
<!DOCTYPE html>
<html>
<head>
    <title>MCP Server Login</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * {{ box-sizing: border-box; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            padding: 20px;
        }}
        .container {{
            background: white;
            padding: 40px;
            border-radius: 16px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            width: 100%;
            max-width: 400px;
        }}
        h1 {{
            margin: 0 0 8px 0;
            font-size: 24px;
            color: #1e293b;
        }}
        .subtitle {{
            color: #64748b;
            margin: 0 0 32px 0;
            font-size: 14px;
        }}
        label {{
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            color: #374151;
        }}
        input[type="password"] {{
            width: 100%;
            padding: 12px 16px;
            border: 2px solid #e2e8f0;
            border-radius: 8px;
            font-size: 16px;
            transition: border-color 0.2s;
        }}
        input[type="password"]:focus {{
            outline: none;
            border-color: #3b82f6;
        }}
        button {{
            width: 100%;
            padding: 14px;
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            margin-top: 24px;
            transition: background 0.2s;
        }}
        button:hover {{
            background: #2563eb;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>Galipo MCP Server</h1>
        <p class="subtitle">Enter the server password to connect Claude</p>
        {error_html}
        <form method="POST">
            <input type="hidden" name="state" value="{state}">
            <input type="hidden" name="client_id" value="{client_id}">
            <input type="hidden" name="redirect_uri" value="{redirect_uri}">
            <input type="hidden" name="scope" value="{scope}">
            <input type="hidden" name="code_challenge" value="{code_challenge}">
            <input type="hidden" name="code_challenge_method" value="{code_challenge_method}">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" required autofocus>
            <button type="submit">Connect</button>
        </form>
    </div>
</body>
</html>
            """)

        # POST: Validate password
        form = await request.form()
        password = form.get("password", "")

        # Get OAuth params from form (stateless - passed through hidden fields)
        state = form.get("state", "")
        client_id = form.get("client_id", "")
        redirect_uri = form.get("redirect_uri", "")
        scope = form.get("scope", "")
        code_challenge = form.get("code_challenge", "")

        if not secrets.compare_digest(str(password), self.password):
            # Wrong password - redirect back to login with error and all params
            params = {
                "error": "Invalid password",
                "state": state,
                "client_id": client_id,
                "redirect_uri": redirect_uri,
                "scope": scope,
                "code_challenge": code_challenge,
            }
            return RedirectResponse(f"/login?{urlencode(params)}", status_code=303)

        # Password correct - validate we have required params
        if not client_id:
            return HTMLResponse("Missing client_id", status_code=400)

        client = await self.get_client(client_id)
        if not client:
            return HTMLResponse(f"Unknown client: {client_id}", status_code=400)

        # Build authorization params
        scopes = scope.split() if scope else []

        auth_request_params = AuthorizationParams(
            redirect_uri=redirect_uri if redirect_uri else None,
            redirect_uri_provided_explicitly=bool(redirect_uri),
            state=state if state else None,
            scopes=scopes,
            code_challenge=code_challenge if code_challenge else None,
        )

        # Call authorize directly - this creates the auth code and returns redirect URI
        redirect_url = await self.authorize(client, auth_request_params)

        return RedirectResponse(redirect_url, status_code=302)


def get_mcp_auth_provider():
    """
    Create an OAuth provider for the MCP/SSE endpoint.

    Requires:
    - MCP_AUTH_PASSWORD: Password users must enter to connect
    - MCP_BASE_URL: Public URL of this server (e.g., https://mcp.example.com)

    Returns None if not configured (server will be authless).
    """
    password = os.getenv("MCP_AUTH_PASSWORD")
    base_url = os.getenv("MCP_BASE_URL")

    if not password or not base_url:
        return None

    return PasswordOAuthProvider(
        base_url=base_url,
        password=password,
    )
