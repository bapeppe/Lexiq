# Fase 1: Build dell'app React
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Nota: se hai creato l'app con Vite, cambia "build" in "dist" nei due comandi successivi
RUN npm run build 

# Fase 2: Serve con Nginx
FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]