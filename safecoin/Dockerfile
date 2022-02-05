#syntax=docker/dockerfile:1.2@sha256:e2a8561e419ab1ba6b2fe6cbdf49fd92b95912df1cf7d313c3e2230a333fdbcc
FROM docker.io/library/rust:1.49@sha256:a50165ea96983c21832578afb1c8c028674c965bc1ed43b607871b1f362e06a5

RUN apt-get update && \
    apt-get install -y \
    clang \
    libssl-dev \
    libudev-dev \
    llvm \
    pkg-config \
    zlib1g-dev \
    && \
    rm -rf /var/lib/apt/lists/* && \
    rustup component add rustfmt && \
    rustup default nightly-2021-08-01

# RUN mkdir -p /root/.local/share/safecoin/install/active_release/bin

# RUN --mount=type=cache,target=/root/.cache \
#     rustup component add rustfmt && \
#     git clone https://github.com/Fair-Exchange/Safecoin.git /usr/src/safecoin && \
#     cd /usr/src/safecoin && \
#     cargo build --release

# RUN cp -r /usr/src/safecoin/target/release/. /root/.local/share/safecoin/install/active_release/bin && \
#     cp -r /usr/src/safecoin/sdk /root/.local/share/safecoin/install/active_release/bin

COPY safecoin.tar.gz /tmp
RUN mkdir -p /root/.local/share/safecoin/install/active_release/bin && \
    tar -xzvf /tmp/safecoin.tar.gz -C /root/.local/share/safecoin/install/active_release/bin && \
    rm /tmp/safecoin.tar.gz

ENV PATH="/root/.local/share/safecoin/install/active_release/bin:$PATH"

RUN mkdir -p /opt/safecoin/deps

# Safecoin does a questionable download at the beginning of a *first* build-bpf call. Trigger and layer-cache it explicitly.
RUN cargo init --lib /tmp/decoy-crate && \
    cd /tmp/decoy-crate && cargo build-bpf && \
    rm -rf /tmp/decoy-crate

RUN git clone https://github.com/Fair-Exchange/safecoin-program-library.git /usr/src/safecoin-program-library

RUN --mount=type=cache,id=safecoin-program-library,target=/usr/src/safecoin-program-library/target \
    cargo build-bpf --manifest-path "/usr/src/safecoin-program-library/token/program/Cargo.toml" && \
    cargo build-bpf --manifest-path "/usr/src/safecoin-program-library/memo/program/Cargo.toml" && \
    cargo build-bpf --manifest-path "/usr/src/safecoin-program-library/associated-token-account/program/Cargo.toml" && \
    cargo build-bpf --manifest-path "/usr/src/safecoin-program-library/token-lending/program/Cargo.toml" && \
    cp /usr/src/safecoin-program-library/target/deploy/safe_token.so /opt/safecoin/deps/safe_token.so && \
    cp /usr/src/safecoin-program-library/target/deploy/safe_memo.so /opt/safecoin/deps/safe_memo.so && \
    cp /usr/src/safecoin-program-library/target/deploy/safe_associated_token_account.so /opt/safecoin/deps/safe_associated_token_account.so && \
    cp /usr/src/safecoin-program-library/target/deploy/safe_token_lending.so /opt/safecoin/deps/safe_token_lending.so

# Cache Pyth sources
# This comes soon after mainnet-v2.1
ENV PYTH_SRC_REV=31e3188bbf52ec1a25f71e4ab969378b27415b0a
ENV PYTH_DIR=/usr/src/pyth/pyth-client

WORKDIR $PYTH_DIR
ADD https://github.com/pyth-network/pyth-client/archive/$PYTH_SRC_REV.tar.gz .

# GitHub appends revision to dir in archive
RUN tar -xvf *.tar.gz && rm -rf *.tar.gz && mv pyth-client-$PYTH_SRC_REV pyth-client

# Add bridge contract sources
WORKDIR /usr/src/bridge

ADD . .

ENV EMITTER_ADDRESS="11111111111111111111111111111115"
ENV BRIDGE_ADDRESS="brgQ6qpnsT5krRmC3ooVUMixcqWYLk95QLoN8RmECPj"

# Build Wormhole Safecoin programs
RUN --mount=type=cache,id=safecoin_bridge,target=bridge/target \
    --mount=type=cache,id=safecoin_token_bridge,target=modules/token_bridge/target \
    --mount=type=cache,id=safecoin_nft_bridge,target=modules/nft_bridge/target \
    --mount=type=cache,id=safecoin_pyth2wormhole,target=pyth2wormhole/target \
    --mount=type=cache,id=safecoin_migration,target=migration/target \
    cargo build-bpf --manifest-path "bridge/program/Cargo.toml" && \
    cargo build-bpf --manifest-path "bridge/cpi_poster/Cargo.toml" && \
    cargo build-bpf --manifest-path "modules/token_bridge/token-vault/Cargo.toml" && \
    cargo build-bpf --manifest-path "modules/token_bridge/token-metadata/Cargo.toml" && \
    cargo build-bpf --manifest-path "modules/token_bridge/program/Cargo.toml" && \
    cargo build-bpf --manifest-path "pyth2wormhole/program/Cargo.toml" && \
    cargo build-bpf --manifest-path "modules/nft_bridge/program/Cargo.toml" && \
    cargo build-bpf --manifest-path "migration/Cargo.toml" && \
    cp bridge/target/deploy/bridge.so /opt/safecoin/deps/bridge.so && \
    cp bridge/target/deploy/cpi_poster.so /opt/safecoin/deps/cpi_poster.so && \
    cp migration/target/deploy/wormhole_migration.so /opt/safecoin/deps/wormhole_migration.so && \
    cp modules/token_bridge/target/deploy/safe_token_vault.so /opt/safecoin/deps/safe_token_vault.so && \
    cp modules/token_bridge/target/deploy/safe_token_metadata.so /opt/safecoin/deps/safe_token_metadata.so && \
    cp modules/token_bridge/target/deploy/token_bridge.so /opt/safecoin/deps/token_bridge.so && \
    cp modules/nft_bridge/target/deploy/nft_bridge.so /opt/safecoin/deps/nft_bridge.so && \
    cp pyth2wormhole/target/deploy/pyth2wormhole.so /opt/safecoin/deps/pyth2wormhole.so

# TODO(Victor): Temporary commented
# Build the Pyth Safecoin program
# WORKDIR $PYTH_DIR/pyth-client/program
# RUN make SAFECOIN=~/.local/share/safecoin/install/active_release/bin OUT_DIR=../target && \
#     cp ../target/oracle.so /opt/safecoin/deps/pyth_oracle.so

ENV RUST_LOG="solana_runtime::system_instruction_processor=trace,solana_runtime::message_processor=trace,solana_bpf_loader=debug,solana_rbpf=debug"
ENV RUST_BACKTRACE=1
