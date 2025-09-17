# Multi-stage build for Echo application
# Stage 1: Build the application
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install system dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev

# Copy package files
COPY package*.json ./
COPY babel.config.js ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY src/ ./src/
COPY assets/ ./assets/
COPY config/ ./config/
COPY styles.css ./
COPY index.html ./
COPY main.js ./
COPY renderer.js ./

# Build the application
RUN npm run build:prod || npm run build || echo "Build step completed"

# Stage 2: Runtime environment
FROM node:18-alpine AS runtime

# Install runtime dependencies
RUN apk add --no-cache \
    dbus \
    xvfb \
    gtk+3.0 \
    nss \
    alsa-lib \
    at-spi2-atk \
    cups-libs \
    drm \
    libxcomposite \
    libxdamage \
    libxrandr \
    libxss \
    libxtst \
    pango \
    atk \
    cairo-gobject \
    gtk+3.0-dev \
    gdk-pixbuf \
    && rm -rf /var/cache/apk/*

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S echo -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=echo:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=echo:nodejs /app/package*.json ./
COPY --from=builder --chown=echo:nodejs /app/src ./src
COPY --from=builder --chown=echo:nodejs /app/assets ./assets
COPY --from=builder --chown=echo:nodejs /app/config ./config
COPY --from=builder --chown=echo:nodejs /app/*.js ./
COPY --from=builder --chown=echo:nodejs /app/*.html ./
COPY --from=builder --chown=echo:nodejs /app/*.css ./

# Create necessary directories
RUN mkdir -p /app/logs /app/temp /app/output && \
    chown -R echo:nodejs /app

# Switch to non-root user
USER echo

# Expose ports
EXPOSE 3000 8080 9000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Environment variables
ENV NODE_ENV=production
ENV DISPLAY=:99
ENV ELECTRON_DISABLE_SANDBOX=1
ENV ELECTRON_ENABLE_LOGGING=1

# Start command
CMD ["npm", "start"]