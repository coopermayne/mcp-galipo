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
COPY tools/ ./tools/
COPY routes/ ./routes/
COPY static/ ./static/
COPY templates/ ./templates/
COPY migrations/ ./migrations/

# Copy built React frontend from builder stage
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

EXPOSE 8000

CMD ["python", "main.py"]
