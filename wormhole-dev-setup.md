# Wormhole dev setup

## Prerequisites
```bash
sudo apt update && sudo apt upgrade -y && \
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash && \
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p
```

NOTE:
- Restart the terminal before the next step

## Install Node.js v16

```bash
nvm install --lts && \
npm i -g yarn
```

## Prepare wallet-adapter

```bash
git clone https://github.com/victorshevtsov/wallet-adapter.git && \
pushd wallet-adapter && \
yarn install && \
yarn build && \
popd
```

## Prepare wormhole

```bash
git clone https://github.com/victorshevtsov/wormhole.git && \
pushd wormhole && \
DOCKER_BUILDKIT=1 docker build --target node-export -f Dockerfile.proto -o type=local,dest=. . && \
DOCKER_BUILDKIT=1 docker build -f safecoin/Dockerfile.wasm -o type=local,dest=. safecoin && \
DOCKER_BUILDKIT=1 docker build -f solana/Dockerfile.wasm -o type=local,dest=. solana && \
npm ci --prefix ethereum && \
npm ci --prefix sdk/js && \
npm run build --prefix sdk/js && \
popd
```
## Install dependencies for wormhole 

```bash
cd wormhole/bridge_ui && \
yarn install
```

## Cinfugure Connection
To make Wormhole UI connecting to Solana and Safecoin dev networks create a file `.env` in the `bridge_ui` dir with the following rows in it:

```
REACT_APP_SAFECOIN_API_URL=https://api.devnet.safecoin.org/
REACT_APP_SOLANA_API_URL=https://api.devnet.solana.com/
```

## Finally start the dev server
```bash
yarn start
```

Happy hacking!
