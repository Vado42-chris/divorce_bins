FROM node:22-bookworm-slim

# Install Python, venv, and Tesseract OCR dependencies for intelligent parsing
RUN apt-get update && apt-get install -y python3 python3-pip python3-venv tesseract-ocr poppler-utils && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Node Dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Set up Python Virtual Environment and Install Dependencies
COPY requirements.txt ./
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir -r requirements.txt

# Copy Project Source
COPY . .

# Expose backend and frontend proxy ports
EXPOSE 3001 5174

# Start the application
CMD ["npm", "run", "start"]
