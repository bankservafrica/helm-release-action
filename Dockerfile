# Dockerfile

FROM alpine

# Install bash, curl, openssl, git, nodejs, and npm
RUN apk add --no-cache bash curl openssl git nodejs npm

# Install Helm
RUN curl https://raw.githubusercontent.com/helm/helm/master/scripts/get-helm-3 | bash

COPY . ./

# This command will now succeed because npm is installed
RUN npm install js-yaml

ENTRYPOINT ["node", "/index.js"]