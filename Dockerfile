### Dev Stage

FROM node:17 AS development

WORKDIR /usr/src/app

RUN npm install -g pnpm

COPY pnpm-lock.yaml ./
RUN pnpm fetch

COPY --chown=node:node . .
RUN touch config.json

# https://github.com/pnpm/pnpm/issues/2992
RUN pnpm install --shamefully-hoist --offline
RUN pnpm run build

USER node
EXPOSE 8000
CMD [ "pnpm", "run", "dev" ]

### Prod Stage

FROM node:17 AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

RUN npm install -g pnpm

COPY pnpm-lock.yaml ./
RUN pnpm fetch --prod

COPY --chown=node:node . .
RUN touch config.json

RUN pnpm install --shamefully-hoist --offline --prod
COPY --from=development /usr/src/app/dist ./dist

USER node
EXPOSE 8000
CMD [ "pnpm", "start" ]
