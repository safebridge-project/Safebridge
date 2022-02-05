use borsh::{
    BorshDeserialize,
    BorshSerialize,
};
use serde::{
    Deserialize,
    Serialize,
};
use safecoin_program::pubkey::Pubkey;
use solitaire::{
    pack_type,
    processors::seeded::{
        AccountOwner,
        Owned,
    },
};
use safe_token::state::{
    Account,
    Mint,
};

#[derive(Default, Clone, Copy, BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
pub struct PoolData {
    pub from: Pubkey,
    pub to: Pubkey,
}

impl Owned for PoolData {
    fn owner(&self) -> AccountOwner {
        AccountOwner::This
    }
}

pack_type!(SplMint, Mint, AccountOwner::Other(safe_token::id()));
pack_type!(SplAccount, Account, AccountOwner::Other(safe_token::id()));
