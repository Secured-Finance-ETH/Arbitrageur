use std::{fs::File, io::Read, env};
use ethers::{prelude::{LocalWallet, Contract, SignerMiddleware}, abi::{Address, Abi}, providers::{Provider, Http, Middleware}};
use serde_json::Value;

ethers::contract::abigen!(LendingMarket, "../contractABI/LendingMarket.json");

pub fn generate_signer() -> Result<SignerMiddleware<Provider<Http>, LocalWallet>, Box<dyn std::error::Error>> {
  // Load ENV variables 
  let private_key = env::var("PRIVATE_KEY").expect("PRIVATE_KEY must be set");
  let node_provider_url = env::var("NODE_URL").expect("NODE_URL must be set");

  // Setup contract instance
  let provider: Provider<Http> = Provider::<Http>::try_from(node_provider_url)?;
  let wallet: LocalWallet = private_key.parse::<LocalWallet>()?;
  let signer_client = SignerMiddleware::<Provider<Http>, LocalWallet>::new(provider, wallet).into();

  Ok(signer_client)
}

pub fn extract_address(file_path: &str) -> Result<Address, Box<dyn std::error::Error>> {
  // Read JSON file, convert it to string and parse it to Value
  let mut file = File::open(file_path)?;
  let mut contents = String::new();
  file.read_to_string(&mut contents)?;

  // Parse contract address and abi
  let contract_data: Value = serde_json::from_str(&contents)?;
  let contract_address: Address = contract_data["address"].as_str().unwrap().parse::<Address>()?;

  Ok(contract_address)
}