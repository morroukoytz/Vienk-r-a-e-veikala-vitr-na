# Backend image: Python 3.12 + FastAPI
FROM python:3.12-slim

# Do not create .pyc files and print logs immediately
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /code

# 1) Install dependencies first (this layer is cached between builds)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 2) Copy the application code
COPY app ./app

# 3) Run as a normal (non-root) user for better security
RUN useradd --create-home appuser
USER appuser

EXPOSE 8000

# Start the API server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
