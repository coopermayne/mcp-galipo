# Video Processing Feature - Implementation Plan

## Overview

Add an ephemeral video processing utility to Galipo. Users upload a video (pre-trimmed in the browser via ffmpeg.wasm), then request operations like clipping, zooming, and frame-by-frame PDF extraction. Processing happens asynchronously on the server with ffmpeg. Results are available for download, then auto-purged after 2 hours.

This is a **standalone utility** — not tied to any case. It lives at `/video` in the nav.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  BROWSER                                                │
│                                                         │
│  1. User drops video into upload zone                   │
│  2. ffmpeg.wasm trims to selected range (client-side)   │
│  3. Trimmed clip uploads to server                      │
│  4. User picks operations (clip, zoom, frame PDF)       │
│  5. SSE stream shows progress                           │
│  6. Download results when ready                         │
│                                                         │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│  SERVER                                                 │
│                                                         │
│  POST /api/v1/video/upload     → save to temp dir       │
│  POST /api/v1/video/{id}/process → queue ffmpeg jobs    │
│  GET  /api/v1/video/{id}/status  → SSE progress stream  │
│  GET  /api/v1/video/{id}/files   → list output files    │
│  GET  /api/v1/video/{id}/download/{filename} → download │
│  DELETE /api/v1/video/{id}       → manual cleanup       │
│                                                         │
│  Background: cleanup task purges sessions > 2h old      │
│  Throttle: asyncio.Semaphore limits concurrent jobs     │
│                                                         │
│  Storage: /tmp/galipo-video/{uuid}/                     │
│           ├── source.mp4                                │
│           ├── clip_001.mp4                              │
│           ├── zoom_001.mp4                              │
│           └── frames.pdf                                │
└─────────────────────────────────────────────────────────┘
```

---

## File Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `routes/video.py` | All video API endpoints + SSE + cleanup task |
| `frontend/src/pages/Video.tsx` | Main video processing page |
| `frontend/src/api/video.ts` | API client functions for video endpoints |
| `frontend/src/components/video/VideoUploader.tsx` | Drag-and-drop upload with ffmpeg.wasm pre-trim |
| `frontend/src/components/video/VideoPlayer.tsx` | Video player with trim controls, zoom region selector |
| `frontend/src/components/video/ProcessingPanel.tsx` | Job configuration (pick operations) and progress display |
| `frontend/src/components/video/ResultsPanel.tsx` | Download links for processed outputs |

### Modified Files

| File | Change |
|------|--------|
| `routes/__init__.py` | Add `register_video_routes` to the registration chain |
| `frontend/src/App.tsx` | Add `/video` route |
| `frontend/src/components/layout/Sidebar.tsx` | Add "Video" nav item |
| `Dockerfile` | No change needed — `routes/` directory already copied |
| `requirements.txt` | Add `python-multipart` (if not present — needed for file uploads) |
| `frontend/package.json` | Add `@ffmpeg/ffmpeg` and `@ffmpeg/util` |

---

## Backend Implementation

### 1. `routes/video.py`

This is the only new backend file. No database models, no migrations.

```python
"""
Video processing routes — ephemeral video tool.

All state lives on the filesystem in /tmp/galipo-video/{session_id}/.
No database involvement. Auto-cleanup after 2 hours.
"""
```

#### Constants & State

```python
import asyncio
import uuid
import json
import time
import shutil
import subprocess
from pathlib import Path
from starlette.responses import JSONResponse, FileResponse, StreamingResponse

VIDEO_DIR = Path("/tmp/galipo-video")
MAX_UPLOAD_MB = 500
MAX_CONCURRENT_JOBS = 2
SESSION_TTL_SECONDS = 2 * 60 * 60  # 2 hours
CLEANUP_INTERVAL_SECONDS = 10 * 60  # check every 10 min

# In-process job management
_semaphore = asyncio.Semaphore(MAX_CONCURRENT_JOBS)
_sessions: dict[str, dict] = {}  # session_id -> metadata (status, progress, outputs)
```

#### Endpoints

**POST `/api/v1/video/upload`**
- Accept multipart file upload
- Generate UUID session ID
- Create directory `/tmp/galipo-video/{uuid}/`
- Save uploaded file as `source.mp4` (or original extension)
- Use ffprobe to extract video metadata (duration, resolution, codec, fps)
- Store session metadata in `_sessions` dict
- Return `{ session_id, filename, duration, resolution, fps }`

**POST `/api/v1/video/{session_id}/process`**
- Accept JSON body describing requested operations:
  ```json
  {
    "operations": [
      {
        "type": "clip",
        "start": 10.5,
        "end": 25.0,
        "label": "clip_deposition_excerpt"
      },
      {
        "type": "zoom",
        "start": 10.5,
        "end": 15.0,
        "x": 0.25,
        "y": 0.1,
        "width": 0.5,
        "height": 0.5,
        "output_scale": "1920x1080"
      },
      {
        "type": "frames_pdf",
        "start": 10.5,
        "end": 12.0,
        "fps": 2,
        "label": "exhibit_frames"
      }
    ]
  }
  ```
- Validate session exists, source file present
- Queue processing as a background `asyncio.Task`
- Return `{ status: "queued", operations: [...] }`

**GET `/api/v1/video/{session_id}/status`**
- Return SSE (Server-Sent Events) stream
- Content-Type: `text/event-stream`
- Events:
  - `{ event: "progress", data: { operation: "clip", step: 1, total: 3, percent: 45 } }`
  - `{ event: "complete", data: { operation: "clip", filename: "clip_001.mp4" } }`
  - `{ event: "all_complete", data: { files: [...] } }`
  - `{ event: "error", data: { operation: "zoom", message: "..." } }`
- Keep connection open until all operations finish or error
- Alternatively, a simple polling endpoint that returns current status JSON (simpler to implement, SSE is nice-to-have)

**GET `/api/v1/video/{session_id}/files`**
- List all output files for the session
- Return `{ files: [{ name, size_mb, type, created_at }] }`

**GET `/api/v1/video/{session_id}/download/{filename}`**
- Serve the file via `FileResponse`
- Validate filename doesn't escape the session directory (path traversal protection!)

**DELETE `/api/v1/video/{session_id}`**
- Immediately delete session directory and metadata
- Return `{ success: true }`

#### FFmpeg Processing Functions

Each operation maps to an ffmpeg command run via `asyncio.create_subprocess_exec`:

**Clip:**
```bash
ffmpeg -i source.mp4 -ss {start} -to {end} -c copy -avoid_negative_ts make_zero clip_{label}.mp4
```
Uses `-c copy` for fast stream copy (no re-encode) when possible. Falls back to re-encode if timestamps aren't keyframe-aligned (check output duration, re-run with re-encode if needed).

**Zoom (crop + scale):**
```bash
# First get source dimensions via ffprobe
ffprobe -v quiet -print_format json -show_streams source.mp4

# Then crop and scale
ffmpeg -i source.mp4 -ss {start} -to {end} \
  -vf "crop={crop_w}:{crop_h}:{crop_x}:{crop_y},scale={output_w}:{output_h}" \
  -c:v libx264 -preset medium -crf 18 -c:a aac \
  zoom_{label}.mp4
```
The API receives normalized coordinates (0-1 range), backend converts to pixels based on source resolution.

**Frames PDF:**
```bash
# Extract frames
ffmpeg -i source.mp4 -ss {start} -to {end} -vf fps={fps} frames/frame_%04d.png

# Then use Pillow/reportlab to compose into PDF
```

For the PDF generation, use **Pillow** (already implied by the stack) or **reportlab**:
- Extract frames as PNGs to a temp subdirectory
- Create a PDF with one frame per page (or grid layout — configurable)
- Include timestamp annotation on each frame
- Output as `frames_{label}.pdf`

Since the project already has `weasyprint` and `pypdf` in requirements.txt, you can alternatively use those for PDF assembly. Pillow is the simplest path for image→PDF.

#### Background Cleanup Task

```python
async def _cleanup_loop():
    """Runs on startup, purges expired sessions every 10 minutes."""
    while True:
        await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)
        now = time.time()
        for session_dir in VIDEO_DIR.iterdir():
            if session_dir.is_dir():
                age = now - session_dir.stat().st_mtime
                if age > SESSION_TTL_SECONDS:
                    shutil.rmtree(session_dir, ignore_errors=True)
                    _sessions.pop(session_dir.name, None)
```

Start this in the route registration function:
```python
def register_video_routes(mcp):
    VIDEO_DIR.mkdir(parents=True, exist_ok=True)
    asyncio.get_event_loop().create_task(_cleanup_loop())
    # ... register routes ...
```

#### Progress Tracking

For SSE progress, parse ffmpeg's stderr output which contains progress lines:
```
frame=  120 fps=30 q=28.0 size=    1024kB time=00:00:04.00 ...
```

Use `asyncio.create_subprocess_exec` with `stderr=subprocess.PIPE`, read lines in a loop, parse `time=` to calculate progress percentage against the expected duration. Push updates to the SSE stream.

Simpler alternative: don't parse ffmpeg output, just report operation-level progress (1/3 operations complete, 2/3, etc). This is much simpler and probably sufficient.

---

## Frontend Implementation

### 2. Dependencies

Add to `frontend/package.json`:
```json
{
  "@ffmpeg/ffmpeg": "^0.12.15",
  "@ffmpeg/util": "^0.12.2"
}
```

ffmpeg.wasm loads a ~25MB WASM binary on first use. It should be lazy-loaded (only when the user navigates to `/video`).

### 3. `frontend/src/api/video.ts`

```typescript
import { request, API_BASE } from './common';

export async function uploadVideo(file: File, onProgress?: (pct: number) => void) {
  // Use XMLHttpRequest or fetch with ReadableStream for upload progress
  const formData = new FormData();
  formData.append('file', file);

  // Can't use the standard request() helper because we need
  // multipart/form-data and progress tracking
  const xhr = new XMLHttpRequest();
  return new Promise((resolve, reject) => {
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress((e.loaded / e.total) * 100);
    };
    xhr.onload = () => resolve(JSON.parse(xhr.responseText));
    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.open('POST', `${API_BASE}/video/upload`);
    // Add auth header
    const token = localStorage.getItem('token');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  });
}

export async function processVideo(sessionId: string, operations: Operation[]) {
  return request(`/video/${sessionId}/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operations }),
  });
}

export function subscribeToStatus(sessionId: string, onEvent: (event: StatusEvent) => void) {
  const token = localStorage.getItem('token');
  const es = new EventSource(`${API_BASE}/video/${sessionId}/status?token=${token}`);
  es.onmessage = (e) => onEvent(JSON.parse(e.data));
  es.onerror = () => es.close();
  return () => es.close(); // cleanup function
}

export async function getFiles(sessionId: string) {
  return request<{ files: OutputFile[] }>(`/video/${sessionId}/files`);
}

export async function deleteSession(sessionId: string) {
  return request(`/video/${sessionId}`, { method: 'DELETE' });
}

// Download is just a link: /api/v1/video/{sessionId}/download/{filename}
export function getDownloadUrl(sessionId: string, filename: string) {
  return `${API_BASE}/video/${sessionId}/download/${filename}`;
}
```

### 4. `frontend/src/pages/Video.tsx`

Main page component. This is the orchestrator.

**Page states (step-by-step flow):**

1. **Upload** — drag-and-drop zone + ffmpeg.wasm pre-trim
2. **Configure** — video player with operation controls
3. **Processing** — progress indicators per operation
4. **Results** — download links for all outputs

```
┌─────────────────────────────────────────────────┐
│  Video Tools                                    │
│                                                 │
│  ┌───────────────────────────────────────────┐  │
│  │  Step 1: Upload & Pre-trim                │  │
│  │                                           │  │
│  │  [Drop video here or click to browse]     │  │
│  │                                           │  │
│  │  ▶ ─────●────────────────── ◀  (trim)    │  │
│  │  Start: 00:05:30    End: 00:12:45         │  │
│  │                                           │  │
│  │  [Upload Trimmed Clip (43 MB)]            │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  ┌───────────────────────────────────────────┐  │
│  │  Step 2: Operations                       │  │
│  │                                           │  │
│  │  [+ Add Clip] [+ Add Zoom] [+ Frame PDF] │  │
│  │                                           │  │
│  │  ┌─ Clip 1 ────────────────────────────┐  │  │
│  │  │ Start: 00:01:00  End: 00:02:30      │  │  │
│  │  │ Label: witness_statement        [x] │  │  │
│  │  └─────────────────────────────────────┘  │  │
│  │                                           │  │
│  │  ┌─ Zoom 1 ───────────────────────────┐  │  │
│  │  │ Region: [select on video]           │  │  │
│  │  │ Time: 00:00:30 - 00:00:45           │  │  │
│  │  │ Output: 1920x1080              [x]  │  │  │
│  │  └─────────────────────────────────────┘  │  │
│  │                                           │  │
│  │  ┌─ Frame PDF ────────────────────────┐  │  │
│  │  │ Range: 00:00:10 - 00:00:15          │  │  │
│  │  │ FPS: 2 (1 frame every 0.5s)         │  │  │
│  │  │ Label: exhibit_a               [x]  │  │  │
│  │  └─────────────────────────────────────┘  │  │
│  │                                           │  │
│  │         [Process All Operations]          │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  ┌───────────────────────────────────────────┐  │
│  │  Step 3: Results                          │  │
│  │                                           │  │
│  │  ✓ clip_witness_statement.mp4  [Download] │  │
│  │  ⏳ zoom_001.mp4  Processing (45%)...     │  │
│  │  ○ frames_exhibit_a.pdf  Queued           │  │
│  │                                           │  │
│  │  [Download All as ZIP]  [Start Over]      │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

**State management:** Use local `useState`/`useReducer` — no TanStack Query needed since this isn't server-cached data. The page is a self-contained workflow.

### 5. `frontend/src/components/video/VideoUploader.tsx`

**Responsibilities:**
- Drag-and-drop zone (accept video/* MIME types)
- Load ffmpeg.wasm on first interaction (lazy, with loading indicator)
- HTML5 `<video>` element for preview
- Range slider or dual-handle slider for trim start/end
- Display: current selection duration, estimated output file size
- "Upload Trimmed Clip" button that:
  1. Runs ffmpeg.wasm to extract the selected range
  2. Uploads the result with progress bar
  3. Returns session info to parent

**ffmpeg.wasm trim command (in browser):**
```javascript
await ffmpeg.exec([
  '-i', 'input.mp4',
  '-ss', startTime.toString(),
  '-to', endTime.toString(),
  '-c', 'copy',
  '-avoid_negative_ts', 'make_zero',
  'trimmed.mp4'
]);
```

**Key UX details:**
- Show "Loading video tools..." while WASM downloads (first time only, cached after)
- Show original file size vs trimmed estimate
- Allow skipping trim (upload full file) if they want
- Max file size warning if trimmed output > 500MB
- Accept common formats: .mp4, .mov, .avi, .mkv, .webm

### 6. `frontend/src/components/video/VideoPlayer.tsx`

**Responsibilities:**
- Play the uploaded video (from a local object URL before upload, or from server after)
- Overlay for zoom region selection (draggable rectangle)
- Time range selection for each operation
- Frame-by-frame stepping (prev/next frame buttons)
- Timestamp display (current time, duration)

**Zoom region selector:**
- Click "Select Zoom Region" → enter selection mode
- Draw a rectangle on the video (mouse drag)
- Rectangle is resizable/movable
- Coordinates stored as normalized 0-1 values (x, y, width, height)
- Show crop preview in a small inset

**For the player itself**, a standard HTML5 `<video>` element with custom controls is sufficient. No need for a library.

### 7. `frontend/src/components/video/ProcessingPanel.tsx`

**Responsibilities:**
- List of configured operations with edit/remove
- "Process All" button
- After submission: SSE-connected progress display per operation
- Progress bars, status icons (queued → processing → done/error)

### 8. `frontend/src/components/video/ResultsPanel.tsx`

**Responsibilities:**
- List completed output files with size
- Individual download buttons
- "Download All as ZIP" (optional — server could zip all outputs)
- "Start Over" button (deletes session, resets page)
- Auto-cleanup notice ("Files will be deleted in X minutes")

---

## Route Registration

In `routes/__init__.py`, add to the registration chain:

```python
from routes.video import register_video_routes

def register_routes(mcp):
    # ... existing routes ...
    register_video_routes(mcp)
    # ... static routes (must be last) ...
```

---

## Frontend Routing & Navigation

### `App.tsx`

```tsx
import { Video } from './pages/Video';
// Inside <Route> for Layout:
<Route path="video" element={<Video />} />
```

### `Sidebar.tsx`

```typescript
import { Film } from 'lucide-react';  // or Video, Clapperboard, Scissors

const baseNavigation = [
  // ... existing items ...
  { name: 'Video', href: '/video', icon: Film },
];
```

---

## Server Dependencies

### `requirements.txt`

Add if not already present:
```
python-multipart
Pillow
```

- `python-multipart` — required by Starlette for multipart file upload parsing
- `Pillow` — for frame image manipulation and PDF assembly

ffmpeg itself must be installed on the server (system package, not pip). Add to Dockerfile:
```dockerfile
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*
```

### `frontend/package.json`

```
npm install @ffmpeg/ffmpeg @ffmpeg/util
```

---

## Security Considerations

1. **Path traversal** — When serving downloads, validate that the requested filename doesn't contain `..` or `/`. Use `Path.resolve()` and check it's still within the session directory.

2. **File type validation** — Check uploaded file MIME type and/or extension. Reject non-video files.

3. **Resource limits:**
   - Max upload size: 500MB (enforced server-side)
   - Max concurrent ffmpeg processes: 2 (semaphore)
   - Per-process timeout: 10 minutes (kill ffmpeg if it hangs)
   - Max sessions: 20 (reject new uploads if at capacity)

4. **No shell injection** — Always use `subprocess` with argument lists, never shell=True. Never interpolate user input into command strings.

5. **Temp directory isolation** — Each session gets its own UUID directory. Sessions cannot access each other's files.

---

## Dockerfile Changes

Add ffmpeg to the system packages:

```dockerfile
# In the Python stage, before pip install:
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
```

No changes needed for COPY lines since `routes/` is already copied as a directory.

---

## Implementation Order

Build in this sequence, testing each step before moving on:

### Phase 1: Backend Foundation
1. Add `python-multipart` and `Pillow` to `requirements.txt`
2. Add `ffmpeg` to Dockerfile
3. Create `routes/video.py` with upload + file listing + download + delete endpoints
4. Register in `routes/__init__.py`
5. Test: upload a video via curl, verify it saves, list files, download, delete

### Phase 2: Basic Frontend
6. Install `@ffmpeg/ffmpeg` and `@ffmpeg/util`
7. Create `frontend/src/api/video.ts`
8. Create `frontend/src/pages/Video.tsx` (basic upload form, no trim yet)
9. Add route to `App.tsx` and nav item to `Sidebar.tsx`
10. Test: upload a video through the UI, see it on the server

### Phase 3: Client-Side Trimming
11. Build `VideoUploader.tsx` with ffmpeg.wasm integration
12. Add trim range selector (dual-handle time slider)
13. Test: trim a video in browser, verify smaller file uploads

### Phase 4: Server Processing
14. Add ffmpeg clip processing to `routes/video.py`
15. Add zoom (crop+scale) processing
16. Add frame extraction + PDF generation
17. Add the process endpoint with job queue and semaphore
18. Test: submit operations via curl, verify outputs

### Phase 5: Processing UI
19. Build `ProcessingPanel.tsx` with operation configuration
20. Build `VideoPlayer.tsx` with time selection and zoom region overlay
21. Add SSE status stream (or polling fallback)
22. Build `ResultsPanel.tsx` with downloads
23. Test: full end-to-end workflow in browser

### Phase 6: Polish
24. Add progress tracking (operation-level at minimum)
25. Add cleanup loop
26. Add error handling and edge cases (corrupt files, unsupported codecs)
27. Add "Download All as ZIP" option
28. File size and session limit enforcement
29. Loading states, error toasts, mobile responsiveness

---

## What's NOT Included (Possible Future Enhancements)

- **Audio extraction** — pull audio track as MP3/WAV
- **Transcription** — send audio to Whisper/Claude for transcription
- **Annotations** — text overlays, arrows, highlights on video
- **Watermarking** — add firm logo/case number overlay
- **Side-by-side comparison** — view two clips simultaneously
- **Case attachment** — optionally link a processing session to a case
- **Persistent storage** — save processed outputs to S3 for long-term
- **Batch processing** — upload multiple videos at once
