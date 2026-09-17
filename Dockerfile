# Multi-stage: hardened Node builder compiles the static bundle,
# hardened nginx serves it. The game runs entirely in the browser.
FROM registry.redhat.io/hi/nodejs:24-builder@sha256:935b21686ec6adfc0efb1cbd304baa4fe42567aac3b0346b9803618033fbdab8 AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM registry.redhat.io/hi/nginx:latest@sha256:19e9f607ea41c26470dcd10d6fc3b483ff3fe88701f9584e4228b62e17b26fe1
COPY --from=builder /app/dist/ /usr/share/nginx/html/
COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf
# Base entrypoint is already the nginx binary: CMD only appends flags.
CMD ["-g", "daemon off;"]
