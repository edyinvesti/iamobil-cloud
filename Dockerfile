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
ENV NODE_OPTIONS="--dns-result-order=ipv4first"
ENV HERMES_API_URL=https://api.groq.com/openai
ENV HERMES_MODEL=llama-3.3-70b-versatile
ENV HERMES_AGENT_NAME=Edy
ENV HERMES_ADAPTER_PORT=18789
ENV CLAW3D_GATEWAY_URL=ws://localhost:18789
ENV CLAW3D_GATEWAY_ADAPTER_TYPE=hermes

# Compilar Next.js
RUN npm run build

# Expor portas (Web e Gateway)
EXPOSE 7860
EXPOSE 18789

# Comando para iniciar o servidor principal (que orquestra o hub e o gateway)
CMD ["node", "server/index.js"]
