FROM node:18-alpine

WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./
COPY prisma ./prisma/

# Instalar dependências
RUN npm ci --only=production
RUN npx prisma generate

# Copiar código da aplicação
COPY . .

# Build da aplicação
RUN npm run build

# Expor porta
EXPOSE 3007

# Comando de inicialização
CMD ["npm", "start"]