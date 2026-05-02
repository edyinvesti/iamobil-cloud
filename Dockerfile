FROM node:20
WORKDIR /app

# Garantir que pastas de persistência existam
RUN mkdir -p data logs

# Copiar dependências
COPY package*.json ./
RUN npm install
RUN npm rebuild sqlite3 --build-from-source

# Copiar código
COPY . .

# Variáveis de ambiente padrão
ENV PORT=7860
ENV NODE_ENV=production

# Compilar Next.js
RUN npm run build

# Expor portas (Web e Gateway)
EXPOSE 7860
EXPOSE 18789

# Comando para iniciar o servidor principal (que orquestra o hub e o gateway)
CMD ["node", "server/index.js"]
