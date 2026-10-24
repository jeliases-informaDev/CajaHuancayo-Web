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
# La politica de seguridad (CSP) de nginx nombra el origen de la API, que queda fijo al compilar igual que VITE_API_URL.
RUN case "$VITE_API_URL" in \
      http*) API_ORIGIN=$(printf '%s' "$VITE_API_URL" | cut -d/ -f1-3); WS_ORIGIN=$(printf '%s' "$API_ORIGIN" | sed 's/^http/ws/') ;; \
      *) API_ORIGIN="'self'"; WS_ORIGIN="'self'" ;; \
    esac \
 && sed -e "s|__API_ORIGIN__|$API_ORIGIN|g" -e "s|__WS_ORIGIN__|$WS_ORIGIN|g" nginx.conf > /app/default.conf

FROM nginxinc/nginx-unprivileged:stable-alpine
COPY --from=build /app/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:8080/health >/dev/null || exit 1
