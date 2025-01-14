const fs = require("fs");
fs.copyFileSync(
  "src/safecoin/core/bridge_bg.wasm",
  "lib/safecoin/core/bridge_bg.wasm"
);
fs.copyFileSync(
  "src/safecoin/core-node/bridge_bg.wasm",
  "lib/safecoin/core-node/bridge_bg.wasm"
);
fs.copyFileSync(
  "src/safecoin/core/bridge_bg.wasm.d.ts",
  "lib/safecoin/core/bridge_bg.wasm.d.ts"
);
fs.copyFileSync(
  "src/safecoin/core-node/bridge_bg.wasm.d.ts",
  "lib/safecoin/core-node/bridge_bg.wasm.d.ts"
);
fs.copyFileSync(
  "src/safecoin/nft/nft_bridge_bg.wasm",
  "lib/safecoin/nft/nft_bridge_bg.wasm"
);
fs.copyFileSync(
  "src/safecoin/nft-node/nft_bridge_bg.wasm",
  "lib/safecoin/nft-node/nft_bridge_bg.wasm"
);
fs.copyFileSync(
  "src/safecoin/nft/nft_bridge_bg.wasm.d.ts",
  "lib/safecoin/nft/nft_bridge_bg.wasm.d.ts"
);
fs.copyFileSync(
  "src/safecoin/nft-node/nft_bridge_bg.wasm.d.ts",
  "lib/safecoin/nft-node/nft_bridge_bg.wasm.d.ts"
);
fs.copyFileSync(
  "src/safecoin/token/token_bridge_bg.wasm",
  "lib/safecoin/token/token_bridge_bg.wasm"
);
fs.copyFileSync(
  "src/safecoin/token-node/token_bridge_bg.wasm",
  "lib/safecoin/token-node/token_bridge_bg.wasm"
);
fs.copyFileSync(
  "src/safecoin/token/token_bridge_bg.wasm.d.ts",
  "lib/safecoin/token/token_bridge_bg.wasm.d.ts"
);
fs.copyFileSync(
  "src/safecoin/token-node/token_bridge_bg.wasm.d.ts",
  "lib/safecoin/token-node/token_bridge_bg.wasm.d.ts"
);
fs.copyFileSync(
  "src/safecoin/migration/wormhole_migration_bg.wasm",
  "lib/safecoin/migration/wormhole_migration_bg.wasm"
);
fs.copyFileSync(
  "src/safecoin/migration-node/wormhole_migration_bg.wasm",
  "lib/safecoin/migration-node/wormhole_migration_bg.wasm"
);
fs.copyFileSync(
  "src/safecoin/migration/wormhole_migration_bg.wasm.d.ts",
  "lib/safecoin/migration/wormhole_migration_bg.wasm.d.ts"
);
fs.copyFileSync(
  "src/safecoin/migration-node/wormhole_migration_bg.wasm.d.ts",
  "lib/safecoin/migration-node/wormhole_migration_bg.wasm.d.ts"
);
