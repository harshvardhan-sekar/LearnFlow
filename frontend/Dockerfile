# Stage 1: Build
FROM node:20-slim AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

# VITE_* vars must be present at build time (baked into the bundle)
ARG VITE_API_URL
ARG VITE_FIREBASE_CONFIG
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_FIREBASE_CONFIG=$VITE_FIREBASE_CONFIG

# Fail fast if required build args are missing
RUN if [ -z "$VITE_API_URL" ]; then echo "ERROR: VITE_API_URL build arg is required" && exit 1; fi && \
    if [ -z "$VITE_FIREBASE_CONFIG" ]; then echo "ERROR: VITE_FIREBASE_CONFIG build arg is required" && exit 1; fi

RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

ENV PORT=80

CMD sh -c "envsubst '\$PORT' < /etc/nginx/conf.d/default.conf > /etc/nginx/conf.d/default.conf.tmp && mv /etc/nginx/conf.d/default.conf.tmp /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"
