# Building
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Serving — nginx static webserver that also proxies /api to the backend.
# A plain static server (e.g. `serve`) cannot forward /api to another host, so
# the SPA's relative /api calls would 404. nginx proxies them to backend:8000.
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
