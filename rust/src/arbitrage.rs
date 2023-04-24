use ethers::types::U256;
use num_enum::TryFromPrimitive;
use std::{collections::HashMap};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::utils;

#[derive(Debug, PartialEq, Clone, TryFromPrimitive)]
#[repr(u32)]
pub enum PositionType {
  LEND = 0,
  BORROW = 1,
}

#[derive(Clone, Debug)]
pub struct Token {
  pub name: Box<str>,
}

#[derive(Clone, Debug)]
pub struct Order {
  pub token: Token,
  // Price form 0 - 10_000
  pub price: i16,
  // Maturity date is uint256 in the contract, but we can use BigNumberish to represent it
  pub maturity: u64,
  pub pos_type: PositionType,
  // Amount of tokens in wei
  pub amount: U256,
}

#[derive(Debug, Clone)]
pub struct Opportunity {
  pub borrow_position: Order,
  pub lend_position: Order,
  // In USD
  pub profit: f64,
}

pub struct Arbitrage {
  pub opportunities: HashMap<i64, Vec<Opportunity>>,
  is_debug_mode: bool,
  token_prices_in_usd: HashMap<String, f64>,
}


// TODO: How to make "private class variables" in Rust
impl Arbitrage {
  #[must_use]
  pub fn new(is_debug_mode: bool) -> Arbitrage {
    let mut arbitrage = Arbitrage {
      is_debug_mode,
      opportunities: HashMap::new(),
      token_prices_in_usd: HashMap::new()
    };

    // TODO: Get prices from API
    arbitrage.token_prices_in_usd.insert("ETH".to_string(), 1.0);
    arbitrage.token_prices_in_usd.insert("EFIL".to_string(), 1.0);
    arbitrage.token_prices_in_usd.insert("WBTC".to_string(), 1.0);
    arbitrage.token_prices_in_usd.insert("USDC".to_string(), 1.0);

    arbitrage
  }

  fn maturity_to_fraction(maturity: u64) -> f64 {
    let one_day_in_seconds: f64 = 24.0 * 60.0 * 60.0;
    let now_in_seconds: u64;

    let now_duration = SystemTime::now().duration_since(UNIX_EPOCH);
    match now_duration {
      Ok(duration) => {
        let seconds_since_epoch = duration.as_secs() as u64;
        now_in_seconds = seconds_since_epoch;
      },
      Err(msg) => panic!("Problem calculating duration since epoch {:?}", msg.to_string())
    }

    let seconds_to_delay = (maturity - now_in_seconds) as f64;
    let days_to_maturity: f64 = seconds_to_delay / one_day_in_seconds;
    
    return days_to_maturity / 365.0;
  }

  fn calculate_rate(price: i32, maturity: u64) -> f64 {
    let mature_price: i32 = 10_000;

    return (mature_price - price) as f64 / ((price as f64) * Arbitrage::maturity_to_fraction(maturity));
  }

  fn calculate_arbitrage<'a>(
    &self,
    orders: &Vec<Order>
  ) -> Vec<Opportunity> {
    let mut opportunities: Vec<Opportunity> = vec![];

    let mut borrow_orders: Vec<&Order> = vec![];
    let mut lend_orders: Vec<&Order> = vec![];

    for order in orders {
      if order.pos_type == PositionType::BORROW {
        borrow_orders.push(order)
      } else {
        lend_orders.push(order);
      }
    }

    // TODO: Fasten naive algorithm with pre-computation, with large datasets
    for b_order in &borrow_orders {
      for l_order in &lend_orders {
        if b_order.token.name == l_order.token.name {
          continue;
        }

        let borrow_order_rate = Arbitrage::calculate_rate(
          b_order.price as i32,
          b_order.maturity
        );
        let lend_order_rate = Arbitrage::calculate_rate(
          l_order.price as i32,
          l_order.maturity
        );

        let rate_differential = lend_order_rate - borrow_order_rate;

        if rate_differential < 0.0 {
          continue;
        }

        let carry_trade_amount: f64 = rate_differential * (b_order.amount.as_u64() as f64);
        let token_name = b_order.token.name.to_string();

        let token_price: f64;
        match self.token_prices_in_usd.get(&token_name) {
          Some(price) =>  token_price = *price,
          None => continue,
        }
        let carry_trade_amount_usd: f64 = carry_trade_amount * token_price;

        // TODO: Pass as params from "ethers.rs", in USD
        let dex_swap_fee = 0;
        let borrow_gas_fee = 0;
        let lend_gas_fee = 0;

        let profit: f64 = carry_trade_amount_usd - (dex_swap_fee + borrow_gas_fee + lend_gas_fee) as f64;

        if profit > 0.0 {
          let opportunity = Opportunity {
            borrow_position: (**b_order).clone(),
            lend_position: (**l_order).clone(),
            profit, 
          };

          opportunities.push(opportunity);
        }
      }

    }

    opportunities
  }

  pub fn calculate_arbitrage_opportunities(
    &mut self,
    positions: &Vec<Order>,
  ) {
    let orders_by_maturity = utils::group_by(positions, | pos | pos.maturity);


    // TODO: Calculate gas fees with "ethers.rs

    for orders in orders_by_maturity.into_iter() {
      let maturity = orders.0;
      let orders_vec_ref = utils::to_ref(orders.1);


      self.opportunities.insert(maturity as i64, self.calculate_arbitrage(&orders_vec_ref));
    }
  }
}

