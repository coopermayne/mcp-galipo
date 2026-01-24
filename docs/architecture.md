# System Architecture

Architecture diagrams for the Galipo legal case management system.

## High-Level Overview

```mermaid
flowchart TB
    subgraph Clients
        React[React Web App<br/>:5173]
        Claude[Claude AI<br/>via MCP]
    end

    subgraph Server["FastAPI + MCP Server (:8000)"]
        Routes[REST Routes<br/>/api/v1/*]
        Tools[MCP Tools<br/>/sse]
        DB_Layer[Database Layer<br/>db/]
    end

    Postgres[(PostgreSQL)]

    React -->|HTTP| Routes
    Claude -->|SSE/MCP| Tools
    Routes --> DB_Layer
    Tools --> DB_Layer
    DB_Layer -->|psycopg2| Postgres
```

## Detailed Component Architecture

```mermaid
flowchart TB
    subgraph Frontend["Frontend (React + Vite)"]
        Pages[Pages<br/>Dashboard, Cases, Tasks, Calendar]
        Components[Components<br/>DataTable, Modal, Forms]
        API_Client[API Client<br/>api/*.ts]
        TanStack[TanStack Query<br/>Cache + Mutations]
        Router[React Router<br/>Protected Routes]
        Auth_Context[Auth Context<br/>JWT Token]
    end

    subgraph Backend["Backend (FastAPI + FastMCP)"]
        Main[main.py<br/>Entry Point]

        subgraph Routes_Layer["Routes Layer"]
            R_Cases[routes/cases.py]
            R_Tasks[routes/tasks.py]
            R_Events[routes/events.py]
            R_Persons[routes/persons.py]
            R_Other[routes/...]
        end

        subgraph Tools_Layer["MCP Tools Layer"]
            T_Cases[tools/cases.py]
            T_Tasks[tools/tasks.py]
            T_Events[tools/events.py]
            T_Persons[tools/persons.py]
            T_Other[tools/...]
        end

        subgraph DB_Layer["Database Layer"]
            D_Cases[db/cases.py]
            D_Tasks[db/tasks.py]
            D_Events[db/events.py]
            D_Persons[db/persons.py]
            D_Connection[db/connection.py]
            D_Validation[db/validation.py]
        end

        Auth[auth.py<br/>Authentication]
    end

    subgraph Database["PostgreSQL"]
        Tables[(cases, persons, tasks,<br/>events, activities, notes,<br/>proceedings, jurisdictions)]
    end

    Pages --> Components
    Pages --> TanStack
    TanStack --> API_Client
    API_Client -->|fetch| Routes_Layer
    Router --> Pages
    Auth_Context --> API_Client

    Main --> Routes_Layer
    Main --> Tools_Layer

    Routes_Layer --> Auth
    Routes_Layer --> DB_Layer
    Tools_Layer --> DB_Layer

    D_Cases --> D_Connection
    D_Tasks --> D_Connection
    D_Events --> D_Connection
    D_Persons --> D_Connection
    D_Connection --> Tables
    D_Validation -.->|validates| DB_Layer
```

## Three-Layer Pattern

Each domain follows the same modular pattern:

```mermaid
flowchart LR
    subgraph Interface["Dual Interface"]
        REST[REST Route<br/>/api/v1/cases]
        MCP[MCP Tool<br/>@mcp.tool]
    end

    subgraph Core["Shared Core"]
        DB[Database Function<br/>db/cases.py]
        Val[Validation<br/>db/validation.py]
    end

    REST --> DB
    MCP --> DB
    DB --> Val
```

**Benefits:**
- Single source of truth for business logic
- Two interfaces (Web UI + AI) share same operations
- Easy to test each layer independently

## Data Flow: Create Case Example

```mermaid
sequenceDiagram
    participant User
    participant React as React UI
    participant Query as TanStack Query
    participant API as API Client
    participant Route as REST Route
    participant DB as Database Layer
    participant Postgres

    User->>React: Click "Create Case"
    React->>Query: useMutation(createCase)
    Query->>API: createCase({name})
    API->>Route: POST /api/v1/cases
    Route->>Route: require_auth()
    Route->>DB: create_case(name)
    DB->>DB: validate_case_status()
    DB->>Postgres: INSERT INTO cases
    Postgres-->>DB: Return new case
    DB-->>Route: Case object
    Route-->>API: JSONResponse
    API-->>Query: Case data
    Query->>Query: invalidate(['cases'])
    Query-->>React: Success
    React-->>User: Navigate to case
```

## Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Login as Login Page
    participant Auth as Auth Context
    participant API as API Client
    participant Server as Backend

    User->>Login: Enter credentials
    Login->>API: POST /api/v1/auth/login
    API->>Server: Validate credentials
    Server-->>API: JWT Token
    API-->>Auth: Store in localStorage
    Auth->>Auth: Set isAuthenticated=true
    Auth-->>Login: Redirect to Dashboard

    Note over Auth,API: Subsequent requests
    Auth->>API: Add Authorization header
    API->>Server: Request + Bearer token
    Server->>Server: Verify token
    Server-->>API: Protected data
```

## Directory Structure

```mermaid
flowchart TB
    subgraph Root["/"]
        main[main.py]
        auth[auth.py]
        database[database.py]
    end

    subgraph db_pkg["db/"]
        connection[connection.py]
        validation[validation.py]
        cases_db[cases.py]
        tasks_db[tasks.py]
        events_db[events.py]
        persons_db[persons.py]
    end

    subgraph tools_pkg["tools/"]
        cases_tools[cases.py]
        tasks_tools[tasks.py]
        events_tools[events.py]
        persons_tools[persons.py]
    end

    subgraph routes_pkg["routes/"]
        cases_routes[cases.py]
        tasks_routes[tasks.py]
        events_routes[events.py]
        persons_routes[persons.py]
    end

    subgraph frontend["frontend/src/"]
        pages[pages/]
        components[components/]
        api[api/]
        types[types/]
        context[context/]
    end

    main --> db_pkg
    main --> tools_pkg
    main --> routes_pkg
    routes_pkg --> auth
    database --> connection
```

## Deployment Architecture

```mermaid
flowchart TB
    subgraph Build["Docker Build"]
        Stage1[Stage 1: Node<br/>npm run build]
        Stage2[Stage 2: Python<br/>Copy dist + deps]
    end

    subgraph Runtime["Production Runtime"]
        App[FastAPI App<br/>python main.py]
        Static[Static Files<br/>/frontend/dist]
    end

    subgraph External
        DB[(PostgreSQL<br/>DATABASE_URL)]
        CDN[CDN / Load Balancer]
    end

    Stage1 -->|dist/| Stage2
    Stage2 --> App
    App --> Static
    App --> DB
    CDN --> App
```

## Key Technologies

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | React 18 | UI Framework |
| Frontend | TanStack Query | Server state management |
| Frontend | TanStack Table | Data tables |
| Frontend | @dnd-kit | Drag and drop |
| Frontend | Tailwind CSS | Styling |
| Frontend | TypeScript | Type safety |
| Frontend | Vite | Build tool |
| Backend | FastAPI | Web framework |
| Backend | FastMCP | MCP server |
| Backend | psycopg2 | PostgreSQL driver |
| Database | PostgreSQL | Primary database |
| Database | JSONB | Flexible data storage |
