FROM node:20-slim AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py database.py tools.py routes.py auth.py ./
COPY db/ ./db/
COPY routes/ ./routes/
COPY services/ ./services/
COPY static/ ./static/
COPY templates/ ./templates/
COPY migrations/ ./migrations/

# Copy built React frontend from builder stage
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

EXPOSE 8000

# Use gunicorn with uvicorn workers for production
# -w 4: 4 worker processes
# -k uvicorn.workers.UvicornWorker: async worker class
# --timeout 120: worker timeout in seconds
CMD ["gunicorn", "main:app", "-k", "uvicorn.workers.UvicornWorker", "-w", "4", "-b", "0.0.0.0:8000", "--timeout", "120"]
