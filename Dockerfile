FROM node:24-slim

WORKDIR /code

COPY package*.json ./

RUN npm ci --omit=dev

ENV NODE_ENV=production

COPY src ./src

EXPOSE 4000

CMD ["node", "src/index.ts"]
