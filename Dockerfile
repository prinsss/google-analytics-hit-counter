### Dev Stage

FROM node:17-alpine AS development

WORKDIR /usr/src/app

RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./

# https://github.com/pnpm/pnpm/issues/2992
RUN pnpm install --shamefully-hoist

COPY --chown=node:node . .
RUN touch config.json

RUN pnpm run build

USER node
EXPOSE 8000
CMD [ "pnpm", "run", "dev" ]

### Prod Stage

FROM node:17-alpine AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --shamefully-hoist --prod

COPY --chown=node:node . .
RUN touch config.json

COPY --from=development /usr/src/app/dist ./dist

USER node
EXPOSE 8000
CMD [ "pnpm", "start" ]
