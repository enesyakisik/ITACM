FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
COPY public ./public
COPY server.js ./

# Run as the unprivileged node user
USER node

EXPOSE 8000

# Schema migration + admin seeding run automatically inside server.js
CMD ["node", "server.js"]
