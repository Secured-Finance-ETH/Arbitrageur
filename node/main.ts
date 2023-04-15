import * as dotenv from "dotenv";
dotenv.config();

import { ethers } from "ethers";
import * as CurrencyControllerABI from "../contractABI/CurrencyController.json" assert { type: "json" };
import * as LendingMarketControllerABI from "../contractABI/LendingMarketController.json" assert { type: "json" };
import * as LendingMarketABI from "../contractABI/LendingMarket.json" assert { type: "json" };
import { assert } from "console";
import { ArbitrageEngine, Order } from "./arbitrage.js";

const EXCLUDED_CURRENCIES_SYMBOL = ["ETH", "WBTC"];

const mappingSymboltoERC20Address = {
  EFIL: "",
  USDC: "",
};

const main = async () => {
  const network = "goerli";
  const provider = new ethers.InfuraProvider(
    network,
    "bb57d75bbd6d4dc08f2a454c74c7dd55"
  );

  // Creating a signing account from a private key
  const signer = new ethers.Wallet(
    "c526ee95bf44d8fc405a158bb884d9d1238d99f0612e9f33d006bb0789009aaa",
    provider
  );
  const currencyContract = new ethers.Contract(
    CurrencyControllerABI.default.address,
    CurrencyControllerABI.default.abi,
    signer
  );

  const lendingControllerContract = new ethers.Contract(
    LendingMarketControllerABI.default.address,
    LendingMarketControllerABI.default.abi,
    signer
  );

  const currencies = await currencyContract.getCurrencies();

  // get list of currency rpc call
  for (const currency of currencies) {
    const symbol = ethers.decodeBytes32String(currency);

    if (EXCLUDED_CURRENCIES_SYMBOL.includes(symbol)) {
      continue;
    }

    // for each currency, call getLendingMarkets -> return address[]
    const contractAddresses = await lendingControllerContract.getLendingMarkets(
      currency
    );
    // for each address contract, call getMaturity, getBorrowUnitPrice, getLendUnitPrice, corresponding maturity
    for (const contractAddress of contractAddresses) {
      const lendingMarketContract = new ethers.Contract(
        contractAddress,
        LendingMarketABI.default.abi,
        signer
      );
      const maturity = await lendingMarketContract.getMaturity();

      //  To get best rate without quantity use, const borrowUnitPrice = await lendingMarketContract.getBorrowUnitPrice();
      const borrowOrders = await lendingMarketContract.getBorrowOrderBook(10);
      const bestOrderBorrowUnitPrice = borrowOrders[0][0];
      const bestOrderBorrowTokenQuantity = borrowOrders[1][0];
      // console.log({ symbol, maturity });
      // console.log(
      //   "bestOrderBorrowUnitPrice ",
      //   bestOrderBorrowUnitPrice.toString()
      // );

      // To get best rate without quantity use, const lendingUnitPrice = await lendingMarketContract.getLendUnitPrice();
      const lendOrders = await lendingMarketContract.getLendOrderBook(10);
      const bestOrderLendUnitPrice = lendOrders[0][0];
      const bestOrderLendTokenQuantity = lendOrders[1][0];

      const possibleOrders: Order[] = [];

      possibleOrders.push({
        token: { name: currency },
        price: bestOrderBorrowUnitPrice,
        maturity: maturity,
        posType: 0,
        amount: bestOrderBorrowTokenQuantity,
      });

      possibleOrders.push({
        token: { name: currency },
        price: bestOrderLendUnitPrice,
        maturity: maturity,
        posType: 0,
        amount: bestOrderLendTokenQuantity,
      });

      const arbitrageEngine = new ArbitrageEngine();

      const arbitrageOpportunities =
        arbitrageEngine.calculateArbitrageOpportunities(possibleOrders);
    }
  }

  // construct data of input for algortihm to run

  // alforithm to run -> get token A to borrow and token B to lend at the same maturity

  // createOrder for token A to borrow

  // swap token A to token B using 1 inch

  // createOrder for token B to lend
};

main();
