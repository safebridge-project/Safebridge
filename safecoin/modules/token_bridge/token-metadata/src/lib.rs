//! A Token Metadata program for the Safecoin blockchain.

pub mod deprecated_instruction;
pub mod deprecated_processor;
pub mod entrypoint;
pub mod error;
pub mod instruction;
pub mod processor;
pub mod state;
pub mod utils;
// Export current sdk types for downstream users building with a different sdk version
pub use safecoin_program;

safecoin_program::declare_id!("mtaPsdZX7fCyCyTXjGpgiiqXQAvBNSZMBWdvMxpBB4j");