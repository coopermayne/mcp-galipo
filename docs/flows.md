# Process Flows

User workflow diagrams for common operations in Galipo.

## Case Intake Workflow

```mermaid
flowchart TD
    Start([User on Cases page]) --> Click[Click + button]
    Click --> Modal[Enter case name]
    Modal --> Create[Create case]
    Create --> Navigate[Navigate to CaseDetail]

    Navigate --> Overview[OverviewTab]

    subgraph EditCase["Edit Case Details"]
        Overview --> EditName[Edit case name/short name]
        Overview --> SetStatus[Set status]
        Overview --> AddSummary[Add case summary]
        Overview --> SetDOI[Set date of injury]
        Overview --> AddPersons[Add persons to case]
    end

    AddPersons --> SelectPerson{Person exists?}
    SelectPerson -->|Yes| AssignPerson[Assign with role/side]
    SelectPerson -->|No| CreatePerson[Create new person]
    CreatePerson --> AssignPerson

    AssignPerson --> Done([Case ready for work])
```

## Task Management Workflow

```mermaid
flowchart TD
    Start([User views tasks]) --> View{View type}

    View -->|Global| TasksPage[Tasks Page<br/>All cases]
    View -->|Case-specific| TasksTab[CaseDetail > TasksTab]

    TasksPage --> TaskList[View task list<br/>Grouped by urgency]
    TasksTab --> TaskList

    TaskList --> Action{Action}

    Action -->|Create| CreateTask[Click add task]
    CreateTask --> EnterDesc[Enter description]
    EnterDesc --> SetDetails[Set due date, urgency]
    SetDetails --> LinkEvent{Link to event?}
    LinkEvent -->|Yes| SelectEvent[Select event]
    LinkEvent -->|No| SaveTask
    SelectEvent --> SaveTask[Save task]
    SaveTask --> TaskList

    Action -->|Update Status| ClickStatus[Click status badge]
    ClickStatus --> SelectStatus[Select new status]
    SelectStatus --> StatusChanged{Status = Done?}
    StatusChanged -->|Yes| SetCompletion[Auto-set completion date]
    StatusChanged -->|No| TaskList
    SetCompletion --> TaskList

    Action -->|Reorder| DragDrop[Drag task]
    DragDrop --> DropTarget[Drop in new position<br/>or urgency group]
    DropTarget --> UpdateOrder[Update sort_order]
    UpdateOrder --> TaskList

    Action -->|Delete| ConfirmDelete[Confirm deletion]
    ConfirmDelete --> TaskList
```

## Task Status Flow

```mermaid
stateDiagram-v2
    [*] --> Pending: Task created

    Pending --> Active: Start work
    Pending --> Blocked: Dependency issue

    Active --> Done: Complete task
    Active --> Blocked: Hit blocker
    Active --> Partially_Done: Partial completion
    Active --> Awaiting_Review: Needs attorney review

    Blocked --> Active: Blocker resolved
    Blocked --> Pending: Reset

    Partially_Done --> Active: Continue work
    Partially_Done --> Done: Finish remaining

    Awaiting_Review --> Done: Approved
    Awaiting_Review --> Active: Changes needed

    Done --> [*]

    note right of Done: Sets completion_date = TODAY
```

## Event/Deadline Management Workflow

```mermaid
flowchart TD
    Start([User manages deadlines]) --> View{View type}

    View -->|Calendar| CalendarPage[Calendar Page<br/>All events]
    View -->|Case-specific| EventsTab[CaseDetail > EventsTab]

    CalendarPage --> EventList[View events<br/>Sorted by date]
    EventsTab --> EventList

    EventList --> Action{Action}

    Action -->|Create| CreateEvent[Click add event]
    CreateEvent --> EnterDetails[Enter description, date]
    EnterDetails --> Optional[Optional: time, location,<br/>document link, calc note]
    Optional --> Star{Mark important?}
    Star -->|Yes| SetStar[Star event]
    Star -->|No| SaveEvent
    SetStar --> SaveEvent[Save event]
    SaveEvent --> EventList

    Action -->|Create linked task| LinkTask[Create task for prep]
    LinkTask --> TaskWithEvent[Task with event_id set]
    TaskWithEvent --> EventList

    Action -->|Edit| EditEvent[Edit inline]
    EditEvent --> EventList

    Action -->|Delete| ConfirmDelete[Confirm deletion]
    ConfirmDelete --> EventList
```

## Person Management Workflow

```mermaid
flowchart TD
    Start([Need to add person to case]) --> Check{Person exists?}

    Check -->|Search| SearchPerson[Search by name/<br/>email/phone/org]
    SearchPerson --> Found{Found?}
    Found -->|Yes| SelectPerson[Select person]
    Found -->|No| CreateNew

    Check -->|Create new| CreateNew[Create person form]
    CreateNew --> BasicInfo[Enter: name, type]
    BasicInfo --> ContactInfo[Add phones, emails]
    ContactInfo --> TypeSpecific{Person type?}

    TypeSpecific -->|Attorney| AttorneyAttrs[Bar number, firm]
    TypeSpecific -->|Expert| ExpertAttrs[Hourly rate, expertises]
    TypeSpecific -->|Judge| JudgeAttrs[Courtroom, chambers]
    TypeSpecific -->|Other| GenericAttrs[Organization, notes]

    AttorneyAttrs --> SavePerson
    ExpertAttrs --> SavePerson
    JudgeAttrs --> SavePerson
    GenericAttrs --> SavePerson[Save person]

    SavePerson --> SelectPerson

    SelectPerson --> AssignRole[Assign to case]
    AssignRole --> SetRole[Set role:<br/>Client, Defendant, Expert, etc.]
    SetRole --> SetSide[Set side:<br/>Plaintiff, Defendant, Neutral]
    SetSide --> Primary{Primary contact?}
    Primary -->|Yes| MarkPrimary[Mark is_primary]
    Primary -->|No| SaveAssignment
    MarkPrimary --> SaveAssignment[Save assignment]

    SaveAssignment --> Done([Person linked to case])
```

## Case Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Signing_Up: Initial contact

    Signing_Up --> Prospective: Evaluating case
    Prospective --> Pre_Filing: Case accepted
    Prospective --> Closed: Declined

    Pre_Filing --> Pleadings: Complaint filed
    Pleadings --> Discovery: Answer received

    Discovery --> Expert_Discovery: Fact discovery complete
    Expert_Discovery --> Pre_trial: Expert reports done

    Pre_trial --> Trial: Trial date set
    Trial --> Post_Trial: Verdict

    Post_Trial --> Appeal: Appeal filed
    Post_Trial --> Closed: Final judgment

    Appeal --> Closed: Appeal resolved

    %% Settlement can happen at any stage
    Discovery --> Settl_Pend: Settlement offer
    Expert_Discovery --> Settl_Pend
    Pre_trial --> Settl_Pend
    Trial --> Settl_Pend

    Settl_Pend --> Closed: Settlement finalized
    Settl_Pend --> Discovery: Settlement falls through

    %% Stay can happen at any stage
    Discovery --> Stayed: Case stayed
    Pleadings --> Stayed
    Stayed --> Discovery: Stay lifted
```

## Full Case Workflow (End to End)

```mermaid
flowchart TB
    subgraph Intake["1. Case Intake"]
        NewCase[Create case] --> AddClient[Add client]
        AddClient --> AddDefendant[Add defendant]
        AddDefendant --> SetJurisdiction[Set jurisdiction]
    end

    subgraph PreFiling["2. Pre-Filing"]
        Investigate[Investigation] --> GatherDocs[Gather documents]
        GatherDocs --> CreateTasks1[Create investigation tasks]
        CreateTasks1 --> DraftComplaint[Draft complaint]
    end

    subgraph Pleadings["3. Pleadings"]
        FileComplaint[File complaint] --> TrackDeadline1[Track response deadline]
        TrackDeadline1 --> ReceiveAnswer[Receive answer]
        ReceiveAnswer --> AddProceeding[Add proceeding with case number]
    end

    subgraph Discovery["4. Discovery"]
        PropoundDiscovery[Propound discovery] --> TrackDeadline2[Track response deadlines]
        TrackDeadline2 --> ScheduleDepos[Schedule depositions]
        ScheduleDepos --> CreateEvents[Create depo events]
        CreateEvents --> CreateTasks2[Create prep tasks]
    end

    subgraph Expert["5. Expert Phase"]
        RetainExperts[Retain experts] --> AddExperts[Add as persons]
        AddExperts --> TrackReports[Track report deadlines]
        TrackReports --> ScheduleExpertDepos[Expert depositions]
    end

    subgraph Trial["6. Trial Prep & Trial"]
        PretrialConf[Pretrial conference] --> TrackMotions[Track motion deadlines]
        TrackMotions --> TrialDate[Trial]
    end

    subgraph Resolution["7. Resolution"]
        Verdict[Verdict/Settlement] --> LogResult[Log result]
        LogResult --> CloseCase[Close case]
    end

    Intake --> PreFiling
    PreFiling --> Pleadings
    Pleadings --> Discovery
    Discovery --> Expert
    Expert --> Trial
    Trial --> Resolution
```

## MCP Tool Usage Flow (Claude AI)

```mermaid
sequenceDiagram
    participant User
    participant Claude as Claude AI
    participant MCP as MCP Server
    participant DB as Database

    User->>Claude: "Show me active cases"
    Claude->>MCP: list_cases(status_filter="Active")
    MCP->>DB: get_all_cases("Active")
    DB-->>MCP: Cases list
    MCP-->>Claude: {cases: [...], total: N}
    Claude-->>User: "Here are your active cases..."

    User->>Claude: "Add a task to case 5"
    Claude->>MCP: add_task(case_id=5, description="...")
    MCP->>DB: add_task(5, "...")
    DB-->>MCP: New task
    MCP-->>Claude: {task: {...}}
    Claude-->>User: "Task created"

    User->>Claude: "What deadlines are coming up?"
    Claude->>MCP: get_events()
    MCP->>DB: get_all_events()
    DB-->>MCP: Events (date >= TODAY)
    MCP-->>Claude: {events: [...]}
    Claude-->>User: "Here are upcoming deadlines..."
```

## Data Synchronization Flow

```mermaid
flowchart LR
    subgraph Frontend
        Mutation[useMutation]
        Cache[Query Cache]
        UI[UI Components]
    end

    subgraph Backend
        Route[REST Route]
        DB[Database]
    end

    Mutation -->|1. POST/PUT/DELETE| Route
    Route -->|2. Execute| DB
    DB -->|3. Return data| Route
    Route -->|4. JSON response| Mutation
    Mutation -->|5. Invalidate queries| Cache
    Cache -->|6. Refetch| Route
    Route -->|7. Fresh data| Cache
    Cache -->|8. Re-render| UI
```
