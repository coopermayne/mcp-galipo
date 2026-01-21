FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py database.py tools.py routes.py ./
COPY static/ ./static/
COPY templates/ ./templates/

EXPOSE 8000

CMD ["python", "main.py"]
