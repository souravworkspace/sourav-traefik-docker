FROM node:8-alpine
LABEL name="sourav-traefik-docker"
LABEL author="Sourav Halder"
WORKDIR /usr/app
COPY package.json ./
RUN npm install
COPY ./src ./src
CMD [ "npm", "start" ]