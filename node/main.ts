import * as dotenv from "dotenv";
dotenv.config();

import BigNumber from "bn.js";
import { ethers, decodeBytes32String, Signer } from "ethers";
import * as CurrencyControllerABI from "../contractABI/CurrencyController.json"
import * as LendingMarketControllerABI from "../contractABI/LendingMarketController.json"
import * as LendingMarketABI from "../contractABI/LendingMarket.json"
import * as TokenVaultABI from "../contractABI/TokenVault.json" 
import * as ERC20ABI from "../contractABI/ERC20.json" 


import { ArbitrageEngine, Order } from "./arbitrage.js";
import { GasEstimator } from "./secured-finance.js";

import { PositionType } from "./arbitrage.js";

const EXCLUDED_CURRENCIES_SYMBOL = ["ETH", "WBTC"];
const USDC_ADDRESS = '0xC851b7AF9FD0dBdb2a1a424D4f8866890a0722B5'

// Maximum trade token amount
const MAX_TRADE = new BigNumber(100);

const depositUsdcCollateral = async (tokenVaultContract: ethers.Contract, signer: Signer): Promise<void> => {
  const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20ABI.default.abi, signer)  
  
  const tokenVaultAddress = await tokenVaultContract.getAddress()
  await usdcContract.approve(tokenVaultAddress, new BigNumber(2).pow(new BigNumber(254)).toString());
  console.log('approved USDC')
};

const main = async () => {
  const network = "goerli";
  const provider = new ethers.InfuraProvider(
    network,
    "bb57d75bbd6d4dc08f2a454c74c7dd55"
  );

  // Creating a signing account from a private key
  const signer = new ethers.Wallet(
    "b827ecb7903e1283873c5fa79ca2479a1cb961b38a33276eb8ef8c7d810aa57e",
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

  const tokenVaultContract = new ethers.Contract(
    TokenVaultABI.default.address,
    TokenVaultABI.default.abi,
    signer
  );

  const possibleOrders: Order[] = [];

  // get list of currency rpc call
  const currencies = await currencyContract.getCurrencies();

  // construct data of input for algortihm to run
  for (const currency of currencies) {
    const symbol = ethers.decodeBytes32String(currency);

    if (EXCLUDED_CURRENCIES_SYMBOL.includes(symbol)) {
      continue;
    }

    // for each currency, call getLendingMarkets -> return address[]
    let contractAddresses = await lendingControllerContract.getLendingMarkets(
      currency
    );

    // FOR DEMO ONLY: only get the first nth maturity
    contractAddresses = contractAddresses.slice(0, 2);

    // for each address contract, call getMaturity, getBorrowUnitPrice, getLendUnitPrice, corresponding maturity
    for (const contractAddress of contractAddresses) {
      const lendingMarketContract = new ethers.Contract(
        contractAddress,
        LendingMarketABI.default.abi,
        signer
      );
      const maturity = new BigNumber(await lendingMarketContract.getMaturity());

      //  To get best rate without quantity use, const borrowUnitPrice = await lendingMarketContract.getBorrowUnitPrice();
      const borrowOrders = await lendingMarketContract.getBorrowOrderBook(1);
      const bestOrderBorrowUnitPrice = new BigNumber(borrowOrders[0][0]);
      const bestOrderBorrowTokenQuantity = new BigNumber(borrowOrders[1][0]);

      //////////////////////////////////////////

      // To get best rate without quantity use, const lendingUnitPrice = await lendingMarketContract.getLendUnitPrice();
      const lendOrders = await lendingMarketContract.getLendOrderBook(1);
      const bestOrderLendUnitPrice = new BigNumber(lendOrders[0][0]);
      const bestOrderLendTokenQuantity = new BigNumber(lendOrders[1][0]);

      if (bestOrderBorrowUnitPrice.gt(new BigNumber(0))) {
        possibleOrders.push({
          token: { name: symbol },
          price: bestOrderBorrowUnitPrice,
          maturity: maturity,
          posType: PositionType.BORROW,
          amount: bestOrderBorrowTokenQuantity.gt(MAX_TRADE)
            ? MAX_TRADE
            : bestOrderBorrowTokenQuantity,
        });
      }

      if (bestOrderLendUnitPrice.gt(new BigNumber(0))) {
        possibleOrders.push({
          token: { name: symbol },
          price: bestOrderLendUnitPrice,
          maturity: maturity,
          posType: PositionType.LEND,
          amount: bestOrderLendTokenQuantity.gt(MAX_TRADE)
            ? MAX_TRADE
            : bestOrderLendTokenQuantity,
        });
      }
    }
  }

  console.log("possibleOrders: ", possibleOrders);

  // for (const possibleOrder of possibleOrders) {
  //   printOrder(possibleOrder);
  // }

  // algorithm to run -> get token A to borrow and token B to lend at the same maturity
  const gasEstimator = new GasEstimator(provider);
  const arbitrageEngine = new ArbitrageEngine(gasEstimator, true);

  arbitrageEngine.calculateArbitrageOpportunities(possibleOrders);
  console.log(
    "arbitrageEngine.arbitrageOpportunities: ",
    arbitrageEngine.arbitrageOpportunities
  );

  const arbitrageOpportunities = Object.values(
    arbitrageEngine.arbitrageOpportunities
  )[1];

  const bestArbitrageOpportunity = arbitrageOpportunities[0];

  console.log("bestArbitrageOpportunity: ", bestArbitrageOpportunity);

  const borrowPosition = bestArbitrageOpportunity.borrowPosition;

  const borrowTokenAddress = ethers.encodeBytes32String(
    borrowPosition.token.name
  );
  const borrowMaturity = borrowPosition.maturity.toString();

  const borrowPositionType = PositionType.BORROW;

  const borrowAmount = borrowPosition.amount
    .mul(new BigNumber(10).pow(new BigNumber(6)))
    .toString();

  const borrowPrice = borrowPosition.price.toString();

  console.log("borrow order param: ", [
    borrowTokenAddress,
    borrowMaturity,
    borrowPositionType,
    borrowAmount,
    borrowPrice,
  ]);

  // function createOrder(bytes32 _ccy, uint256 _maturity, enum ProtocolTypes.Side _side, uint256 _amount, uint256 _unitPrice) external returns (bool)
  await lendingControllerContract.createOrder(
    borrowTokenAddress,
    borrowMaturity,
    1,
    borrowAmount,
    borrowPrice
  );

  // swap token A to token B only for gas calculation

  // createOrder for token B to lend
  const lendingPosition = bestArbitrageOpportunity.lendPosition;

  const lendingTokenAddress = ethers.encodeBytes32String(
    lendingPosition.token.name
  );

  const lendingPositionType = PositionType.LEND;
  const lendingMaturity = lendingPosition.maturity.toString();
  const lendingAmount = lendingPosition.amount
    .mul(new BigNumber(10).pow(new BigNumber(18)))
    .toString();

  const lendingPrice = lendingPosition.price.toString();

  console.log("lending order params: ", [
    lendingTokenAddress,
    lendingMaturity,
    lendingPositionType,
    lendingAmount,
    lendingPrice,
  ]);

  // function depositAndCreateOrder(bytes32 _ccy, uint256 _maturity, enum ProtocolTypes.Side _side, uint256 _amount, uint256 _unitPrice) external payable returns (bool)
  await lendingControllerContract.depositAndCreateOrder(
    lendingTokenAddress,
    lendingMaturity,
    lendingPositionType,
    lendingAmount,
    lendingPrice
  );

  console.log("lending transactionsuccessful!");

  // DONE!
};

const depositCollateral = (tokenVaultContract: ethers.Contract) => {
  // deposit collateral USDC
  tokenVaultContract.deposit(
    "0x5553444300000000000000000000000000000000000000000000000000000000",
    new BigNumber(1).mul(new BigNumber(10).pow(new BigNumber(6)))
  );
};

const printOrder = (order: Order) => {
  console.log({
    "token name": order.token.name,
    price: order.price.toString(),
    maturity: new Date(order.maturity.toNumber() * 1000).toISOString(),
    posType: order.posType == PositionType.BORROW ? "borrow" : "lend",
    amount: order.amount.toString(),
  });
};

main();
