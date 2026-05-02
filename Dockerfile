FROM node:20
WORKDIR /app

# Garantir que pastas de persistência existam
RUN mkdir -p data logs

# Copiar dependências
COPY package*.json ./
RUN npm install

# Copiar código
COPY . .

# Variáveis de ambiente padrão
ENV PORT=3000
ENV NODE_ENV=production

# Compilar Next.js
RUN npm run build

# Expor portas (Web e Gateway)
EXPOSE 3000
EXPOSE 18789

# Comando para iniciar o servidor principal (que orquestra o hub e o gateway)
CMD ["node", "server/index.js"]
