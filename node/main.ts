import * as dotenv from "dotenv";
dotenv.config();

import BigNumber from "bn.js";
import { ethers, decodeBytes32String } from "ethers";
import * as CurrencyControllerABI from "../contractABI/CurrencyController.json" assert { type: "json" };
import * as LendingMarketControllerABI from "../contractABI/LendingMarketController.json" assert { type: "json" };
import * as LendingMarketABI from "../contractABI/LendingMarket.json" assert { type: "json" };
import * as TokenVaultABI from "../contractABI/TokenVault.json" assert { type: "json" };

import { assert } from "console";
import { ArbitrageEngine, Order } from "./arbitrage.js";
import { type } from "os";

const EXCLUDED_CURRENCIES_SYMBOL = ["ETH", "WBTC"];

const mappingSymboltoERC20Address = {
  EFIL: "",
  USDC: "",
};

const MAX_TRADE = new BigNumber(100);

const depositCollateral = (tokenVaultContract: ethers.Contract) => {
  // deposit collateral USDC
  tokenVaultContract.deposit(
    "0x5553444300000000000000000000000000000000000000000000000000000000",
    1
  );
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

  const contractAddressMapping = {};

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

    // FOR DEMO ONLY: only get the first maturity
    contractAddresses = contractAddresses.slice(0, 4);

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

      // To get best rate without quantity use, const lendingUnitPrice = await lendingMarketContract.getLendUnitPrice();
      const lendOrders = await lendingMarketContract.getLendOrderBook(1);
      const bestOrderLendUnitPrice = new BigNumber(lendOrders[0][0]);
      const bestOrderLendTokenQuantity = new BigNumber(lendOrders[1][0]);

      if (bestOrderBorrowUnitPrice.gt(new BigNumber(0))) {
        possibleOrders.push({
          token: { name: symbol },
          price: bestOrderBorrowUnitPrice,
          maturity: maturity,
          posType: 1,
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
          posType: 0,
          amount: bestOrderLendTokenQuantity.gt(MAX_TRADE)
            ? MAX_TRADE
            : bestOrderLendTokenQuantity,
        });
      }
    }
  }

  // algorithm to run -> get token A to borrow and token B to lend at the same maturity
  const arbitrageEngine = new ArbitrageEngine(true);

  console.log("possibleOrders: ", possibleOrders);

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

  console.log(bestArbitrageOpportunity.borrowPosition.amount.toString());

  // depositing USDC as collateral
  // depositCollateral(tokenVaultContract);

  // assuming borrow side enum is 1

  const borrowingParam = [
    ethers.encodeBytes32String(borrowPosition.token.name),
    borrowPosition.maturity
      .mul(new BigNumber(10).pow(new BigNumber(18)))
      .toString(),
    1,
    borrowPosition.amount.toString(),
    borrowPosition.price.toString(),
  ];

  const borrowTokenAddress = ethers.encodeBytes32String(
    borrowPosition.token.name
  );
  const borrowMaturity = borrowPosition.maturity.toString();

  const borrowAmount = borrowPosition.amount
    .mul(new BigNumber(10).pow(new BigNumber(6)))
    .toString();
  const borrowPrice = borrowPosition.price.toString();

  console.log("borrow order param: ", [
    borrowTokenAddress,
    borrowMaturity,
    1,
    borrowAmount,
    borrowPrice,
  ]);

  await lendingControllerContract.createOrder(
    borrowTokenAddress,
    borrowMaturity,
    1,
    borrowAmount,
    borrowPrice
  );

  console.log("borrowing transaction successful!");

  // swap token A to token B only for gas calculation

  // createOrder for token B to lend
  const lendingPosition = bestArbitrageOpportunity.lendPosition;

  const lendingTokenAddress = ethers.encodeBytes32String(
    lendingPosition.token.name
  );

  const lendingMaturity = lendingPosition.maturity.toString();
  const lendingAmount = lendingPosition.amount
    .mul(new BigNumber(10).pow(new BigNumber(18)))
    .toString();

  const lendingPrice = lendingPosition.price.toString();

  console.log("lending order params: ", [
    lendingTokenAddress,
    lendingMaturity,
    0,
    lendingAmount,
    lendingPrice,
  ]);

  // function depositAndCreateOrder(bytes32 _ccy, uint256 _maturity, enum ProtocolTypes.Side _side, uint256 _amount, uint256 _unitPrice) external payable returns (bool)
  await lendingControllerContract.depositAndCreateOrder(
    lendingTokenAddress,
    lendingMaturity,
    0,
    lendingAmount,
    lendingPrice
  );

  console.log("lending transactionsuccessful!");

  // DONE!
};

main();
