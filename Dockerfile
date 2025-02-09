FROM node:20 as build

WORKDIR /usr/src/app

COPY ./package*.json ./

RUN npm install
COPY . .

COPY --chown=node:node package*.json ./

RUN npm ci --only=production

COPY --chown=node:node . .

USER node
EXPOSE 8080
CMD ["node", "index.js"]