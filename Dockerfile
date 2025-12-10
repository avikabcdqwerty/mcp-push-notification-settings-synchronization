# syntax=docker/dockerfile:1

# Use official Python image as base
FROM python:3.11-slim

# Set environment variables for security and UTF-8
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV LANG=C.UTF-8

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y build-essential libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY src/ src/
COPY alembic/ alembic/
COPY alembic.ini .
COPY .env .env

# Expose port for FastAPI
EXPOSE 8000

# Healthcheck for container
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl --fail http://localhost:8000/health || exit 1

# Entrypoint for Alembic migrations and app startup
CMD alembic upgrade head && \
    uvicorn src.main:app --host 0.0.0.0 --port 8000