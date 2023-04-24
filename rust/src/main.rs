pub mod arbitrage;
mod utils;
mod contract;


use std::{sync::Arc};
use ethers::{prelude::*, abi::{Address}};
use arbitrage::{Token, Order, PositionType, Arbitrage};
use contract::{generate_signer};

use dotenv::dotenv;
use lazy_static::lazy_static;
use crate::{contract::extract_address, utils::bytes32_to_string};

// Define contract interfaces
ethers::contract::abigen!(CurrencyController, "../contractABI/CurrencyController.json");
ethers::contract::abigen!(LendingMarketController, "../contractABI/LendingMarketController.json");
ethers::contract::abigen!(LendingMarket, "../contractABI/LendingMarket.json");

lazy_static! {
    static ref MAX_TRADE: U256 = U256::from(100);
}

async fn calculate_best_orders(currencies: &Vec<[u8; 32]>) -> Vec<Order> {
    let mut possible_orders: Vec<Order> = vec!();

    let signer: Arc<SignerMiddleware<Provider<Http>, LocalWallet> > = generate_signer().unwrap().into();

    let lending_market_controller_address = extract_address("../contractABI/LendingMarketController.json").unwrap();
    let lending_market_controller = LendingMarketController::new(lending_market_controller_address, signer.clone());

    for currency in currencies {
        let lending_markets_addresses = lending_market_controller.get_lending_markets(currency.clone()).call().await.unwrap() as Vec<Address>;

        // FOR TESTING PURPOSES
        for address in &lending_markets_addresses[0..2] {
            let lending_market_contract = LendingMarket::new(*address, signer.clone());
            let maturity = lending_market_contract.get_maturity().call().await.unwrap() as U256;

            // Fetch borrow orders
            let borrow_orders = lending_market_contract.get_borrow_order_book(U256::from(1)).call().await.unwrap() as (Vec<U256>, Vec<U256>, Vec<U256>);
            let best_borrow_unit_price = borrow_orders.0.get(0).unwrap();
            let best_borrow_quantity = borrow_orders.1.get(0).unwrap();


            // Fetch lend orders
            let lend_orders = lending_market_contract.get_lend_order_book(U256::from(1)).call().await.unwrap() as (Vec<U256>, Vec<U256>, Vec<U256>);
            let best_lend_unit_price = lend_orders.0.get(0).unwrap();
            let best_lend_quantity = lend_orders.1.get(0).unwrap();

            println!("{:?}", bytes32_to_string(currency).unwrap().to_owned().into_boxed_str());
            // Add the best "borrow" order to the possible orders to lend
            if best_borrow_unit_price.gt(&U256::from(0)) {
                possible_orders.push(Order {
                    token: Token {
                        name: bytes32_to_string(currency).unwrap().to_owned().into_boxed_str(),
                    },
                    price: best_borrow_unit_price.as_u32() as i16,
                    maturity: maturity.as_u64(), 
                    pos_type: PositionType::LEND,
                    amount: if MAX_TRADE.gt(best_borrow_quantity) { best_borrow_quantity.to_owned() } else { *MAX_TRADE },
                })
            }

            // Add the best "lend" order to the possible orders to borrow
            if best_lend_unit_price.gt(&U256::from(0)) {
                possible_orders.push(Order {
                    token: Token {
                        name: bytes32_to_string(currency).unwrap().to_owned().into_boxed_str(),
                    },
                    price: best_lend_unit_price.as_u32() as i16,
                    maturity: maturity.as_u64(), 
                    pos_type: PositionType::BORROW,
                    amount: if MAX_TRADE.gt(best_lend_quantity) { best_lend_quantity.to_owned() } else { *MAX_TRADE },
                })
            }
        }
    }

    return possible_orders;
}

#[tokio::main]
async fn main() {
    // Load the variables from the .env file
    dotenv().ok();

    let currency_controller_address = extract_address("../contractABI/CurrencyController.json").unwrap();

    let signer: Arc<SignerMiddleware<Provider<Http>, LocalWallet> > = generate_signer().unwrap().into();
    let currency_controller = CurrencyController::new(currency_controller_address, signer.clone());

    let supported_currencies = currency_controller.get_currencies().call().await.unwrap() as Vec<[u8; 32]>;

    let orders = calculate_best_orders(&supported_currencies).await;
    
    let mut arbitrage_engine = Arbitrage::new(true);
    arbitrage_engine.calculate_arbitrage_opportunities(&orders);

    println!("Arbitrage opportunities: {:?}", arbitrage_engine.opportunities);
}
