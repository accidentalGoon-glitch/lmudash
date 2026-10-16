# build stage
FROM node:18-alpine as builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
ARG VITE_BACKEND=http://backend:4000
ENV VITE_BACKEND=${VITE_BACKEND}
RUN npm run build

# production stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx","-g","daemon off;"]
