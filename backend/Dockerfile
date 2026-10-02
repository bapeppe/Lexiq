# Usa un'immagine Node.js leggera
FROM node:18-alpine

# Imposta la cartella di lavoro all'interno del container
WORKDIR /usr/src/app

# Copia i file delle dipendenze per sfruttare la cache
COPY package*.json ./

# Installa i pacchetti npm
RUN npm install

# Copia tutto il resto del codice del tuo progetto
COPY . .

# Esponi la porta del server (cambia 5000 se usi un'altra porta per Express)
EXPOSE 5000

# Il comando per avviare la tua app
CMD ["npm", "start"]

