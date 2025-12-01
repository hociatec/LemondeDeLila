# syntax=docker/dockerfile:1.6

FROM mcr.microsoft.com/devcontainers/php:8.2-bullseye

ARG NODE_VERSION=18
ARG USERNAME=vscode
ARG WORKDIR=/workspace

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        curl \
        gnupg \
        lsb-release \
        ca-certificates \
        software-properties-common \
        unzip \
        git \
        locales \
    && locale-gen en_US.UTF-8 fr_FR.UTF-8

# Install Temurin JDK 21 and Maven
RUN mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://packages.adoptium.net/artifactory/api/gpg/key/public | gpg --dearmor -o /etc/apt/keyrings/adoptium.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/adoptium.gpg] https://packages.adoptium.net/artifactory/deb $(lsb_release -sc) main" > /etc/apt/sources.list.d/adoptium.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends temurin-21-jdk maven \
    && rm -rf /var/lib/apt/lists/*

ENV JAVA_HOME=/usr/lib/jvm/temurin-21-jdk-amd64
ENV PATH=$JAVA_HOME/bin:$PATH

# Install Node.js + Yarn
RUN curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - \
    && apt-get update \
    && apt-get install -y --no-install-recommends nodejs \
    && npm install -g yarn \
    && rm -rf /var/lib/apt/lists/*

# Install Symfony CLI
RUN curl -1sLf 'https://dl.cloudsmith.io/public/symfony/stable/setup.deb.sh' | bash \
    && apt-get update \
    && apt-get install -y symfony-cli \
    && rm -rf /var/lib/apt/lists/*

# Ensure composer cache dir exists for non-root user
RUN install -d -o ${USERNAME} -g ${USERNAME} /home/${USERNAME}/.cache/composer

WORKDIR ${WORKDIR}

USER ${USERNAME}

CMD ["sleep", "infinity"]
