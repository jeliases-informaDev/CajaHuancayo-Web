# Auditoria de Visitas - panel web (Vite + React). Se compila y se sirve con nginx, sin ejecutar Node en produccion.
# La direccion de la API queda fija al compilar:  docker build --build-arg VITE_API_URL=https://api-auditoria.sulotec.com .
FROM node:24-slim AS build
ARG VITE_API_URL=https://api-auditoria.sulotec.com
ENV VITE_API_URL=$VITE_API_URL
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:8080/health >/dev/null || exit 1
