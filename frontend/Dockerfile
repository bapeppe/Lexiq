FROM node:22-alpine AS build
WORKDIR /app
ARG API_URL=http://100.96.72.20:5000
ARG VITE_API_URL=http://100.96.72.20:5000
ENV API_URL=$API_URL
ENV VITE_API_URL=$VITE_API_URL
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime
ENV API_URL=http://100.96.72.20:5000
COPY --chown=101:101 nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build --chown=101:101 /app/dist /usr/share/nginx/html
USER 101:101
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -q -O /dev/null "http://${HOSTNAME}:3000/health" || exit 1
CMD ["nginx", "-g", "daemon off;"]
