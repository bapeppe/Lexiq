# Fase 1: Build dell'app React
FROM node:22-alpine AS builder
WORKDIR /app
ARG API_URL=http://100.96.72.20:5000
ARG VITE_API_URL=http://100.96.72.20:5000
ENV API_URL=$API_URL
ENV VITE_API_URL=$VITE_API_URL
COPY package*.json ./
RUN npm install
COPY . .
# Nota: se hai creato l'app con Vite, cambia "build" in "dist" nei due comandi successivi
RUN npm run build 


# Fase 2: Serve con Nginx
FROM nginx:alpine
ENV API_URL=http://100.96.72.20:5000
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
