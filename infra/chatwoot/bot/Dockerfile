FROM node:22-alpine
WORKDIR /app
COPY *.mjs ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s CMD wget -qO- http://127.0.0.1:4000/health || exit 1
CMD ["node", "server.mjs"]
