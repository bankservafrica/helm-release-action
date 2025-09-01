FROM alpine

# Install bash
RUN apk add --no-cache bash curl openssl git nodejs

# Install Helm
RUN curl https://raw.githubusercontent.com/helm/helm/master/scripts/get-helm-3 | bash

COPY . ./

RUN npm install js-yaml

ENTRYPOINT ["node", "/index.js"]