FROM node:22

EXPOSE 3000

RUN useradd --user-group --create-home --shell /bin/false app
RUN npm i -g npm@10.8.0

ENV HOME=/home/app
ENV TZ=America/Sao_Paulo

ADD package.json $HOME/webapp/
RUN chown -R app:app $HOME/*

USER app
WORKDIR $HOME/webapp
RUN npm install

USER root
ADD . $HOME/webapp
RUN chown -R app:app $HOME/*
USER app

CMD ["npm", "start"]