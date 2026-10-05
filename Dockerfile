FROM python:3.10-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy over the project files
COPY . .

# Set environment variables
ENV PYTHONPATH=/app

# ROS bridge config (deafult)
ENV ROSBRIDGE_HOST=localhost
ENV ROSBRIDGE_PORT=9090

# Web app port
EXPOSE 8000

# Start the app
CMD ["python", "app/main.py"]