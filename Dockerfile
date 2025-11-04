# --- BUILD (com ferramentas nativas) ---
FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++ git curl
COPY package*.json ./
RUN npm install
COPY . .
# Se usa TypeScript/Vite, mantém:
RUN npm run build

# --- RUNTIME (leve) ---
FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

# Artefatos e código necessários em produção:
COPY --from=build /app/dist ./dist
# Descomente se o app depende destes diretórios em runtime:
# COPY --from=build /app/server ./server
# COPY --from=build /app/shared ./shared
# COPY --from=build /app/data ./data

EXPOSE 5000
EXPOSE 5060/udp
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health',r=>process.exit(r.statusCode===200?0:1))"
CMD ["npm","start"]
