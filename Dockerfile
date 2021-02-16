FROM node:14-alpine

WORKDIR /app

COPY . .

RUN touch config.json && \
  npm ci --production

EXPOSE 8000
CMD [ "npm", "start" ]
