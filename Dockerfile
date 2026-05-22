FROM node:20-slim AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim

WORKDIR /app

# WeasyPrint system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf-2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py models.py tools.py auth.py mcp_auth.py mcp_stdio.py config.py alembic.ini ./
COPY lib/ ./lib/
COPY schemas/ ./schemas/
COPY alembic/ ./alembic/
COPY db/ ./db/
COPY routes/ ./routes/
COPY services/ ./services/
COPY static/ ./static/
COPY templates/ ./templates/
COPY scripts/ ./scripts/

# Copy built React frontend from builder stage
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Bake git commit hash into the image for /api/v1/health
ARG GIT_COMMIT=unknown
ENV GIT_COMMIT=${GIT_COMMIT}

EXPOSE 8000

# Use gunicorn with uvicorn workers for production
# -w 4: 4 worker processes
# -k uvicorn.workers.UvicornWorker: async worker class
# --timeout 120: worker timeout in seconds
# Single worker for now - OAuth state is in-memory and not shared across workers
# TODO: Move OAuth state to Redis/database for multi-worker support
CMD ["sh", "-c", "alembic upgrade head && gunicorn main:app -k uvicorn.workers.UvicornWorker -w 1 -b 0.0.0.0:8000 --timeout 120"]
