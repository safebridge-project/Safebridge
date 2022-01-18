#[derive(Deserialize, Serialize)]
pub struct Config {
    symbols: Vec<P2WSymbol>,
}

/// Config entry for a Pyth2Wormhole product + price pair
#[derive(Deserialize, Serialize)]
pub struct P2WSymbol {
    /// User-defined human-readable name
    name: Option<String>,
    product: Pubkey,
    price: Pubkey,
}

#[testmod]
mod tests {
    #[test]
    fn test_sanity() -> Result<(), ErrBox> {
        let serialized = r#"
symbols:
  - name: ETH/USD
    product: 111111111111111
    price: 111111111111111
  - name: SOL/EUR
    product: 222222222222222
    price: 222222222222222
  - name: BTC/CNY
    product: 333333333333333
    price: 333333333333333
"#;
        let deserialized = serde_yaml::from_str(serialized)?;
        Ok(())
    }
}
