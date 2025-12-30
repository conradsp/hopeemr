# Dockerfile for Medplum EMR Application - Development Mode
FROM node:24-slim

# Install wget for healthcheck
RUN apt-get update && apt-get install -y wget && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Declare build args
ARG VITE_MEDPLUM_BASE_URL
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_MEDPLUM_CLIENT_ID

# Create .env file from build args
RUN echo "VITE_MEDPLUM_BASE_URL=${VITE_MEDPLUM_BASE_URL}" > .env && \
    echo "VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}" >> .env && \
    echo "VITE_MEDPLUM_CLIENT_ID=${VITE_MEDPLUM_CLIENT_ID}" >> .env && \
    echo "=== Environment Configuration ===" && \
    cat .env && \
    echo "=================================="

# Expose Vite dev server port
EXPOSE 3000

# Health check - use curl which comes with node image or install wget
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Start Vite dev server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]

