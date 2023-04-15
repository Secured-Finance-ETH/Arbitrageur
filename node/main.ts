import * as dotenv from "dotenv";
dotenv.config();

import { ethers } from "ethers";
import * as CurrencyControllerABI from "../contractABI/CurrencyController.json" assert { type: "json" };
import * as LendingMarketControllerABI from "../contractABI/LendingMarketController.json" assert { type: "json" };
import * as LendingMarketABI from "../contractABI/LendingMarket.json" assert { type: "json" };
import * as TokenVaultABI from "../contractABI/TokenVault.json" assert { type: "json" };

import { assert } from "console";
import { ArbitrageEngine, Order } from "./arbitrage.js";

const EXCLUDED_CURRENCIES_SYMBOL = ["ETH", "WBTC"];

const mappingSymboltoERC20Address = {
  EFIL: "",
  USDC: "",
};

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
    contractAddresses = contractAddresses.slice(0, 1);

    // for each address contract, call getMaturity, getBorrowUnitPrice, getLendUnitPrice, corresponding maturity
    for (const contractAddress of contractAddresses) {
      const lendingMarketContract = new ethers.Contract(
        contractAddress,
        LendingMarketABI.default.abi,
        signer
      );
      const maturity = await lendingMarketContract.getMaturity();

      //  To get best rate without quantity use, const borrowUnitPrice = await lendingMarketContract.getBorrowUnitPrice();
      const borrowOrders = await lendingMarketContract.getBorrowOrderBook(1);
      const bestOrderBorrowUnitPrice = borrowOrders[0][0];
      const bestOrderBorrowTokenQuantity = borrowOrders[1][0];
      // console.log({ symbol, maturity });
      // console.log(
      //   "bestOrderBorrowUnitPrice ",
      //   bestOrderBorrowUnitPrice.toString()
      // );

      // To get best rate without quantity use, const lendingUnitPrice = await lendingMarketContract.getLendUnitPrice();
      const lendOrders = await lendingMarketContract.getLendOrderBook(1);
      const bestOrderLendUnitPrice = lendOrders[0][0];
      const bestOrderLendTokenQuantity = lendOrders[1][0];

      if (bestOrderBorrowUnitPrice > 0) {
        possibleOrders.push({
          token: { name: currency },
          price: bestOrderBorrowUnitPrice,
          maturity: maturity,
          posType: 1,
          amount: bestOrderBorrowTokenQuantity,
        });
      }

      if (bestOrderLendUnitPrice > 0) {
        possibleOrders.push({
          token: { name: currency },
          price: bestOrderLendUnitPrice,
          maturity: maturity,
          posType: 0,
          amount: bestOrderLendTokenQuantity,
        });
      }
    }
  }

  // alforithm to run -> get token A to borrow and token B to lend at the same maturity
  const arbitrageEngine = new ArbitrageEngine();

  arbitrageEngine.calculateArbitrageOpportunities(possibleOrders);
  const arbitrageOpportunities = Object.values(
    arbitrageEngine.arbitrageOpportunities
  )[0];

  const bestArbitrageOpportunity = arbitrageOpportunities[0];

  const borrowPosition = bestArbitrageOpportunity.borrowPosition;

  // depositing USDC as collateral
  depositCollateral(tokenVaultContract);

  // createOrder for token A to borrow
  const borrowPositionAddress =
    await lendingControllerContract.getLendingMarket(
      borrowPosition.token,
      borrowPosition.maturity
    );

  const borrowPositionContract = new ethers.Contract(
    borrowPositionAddress,
    LendingMarketABI.default.abi,
    signer
  );

  // function createOrder(bytes32 _ccy, uint256 _maturity, enum ProtocolTypes.Side _side, uint256 _amount, uint256 _unitPrice)
  // assuming borrow side enum is 1
  borrowPositionContract.createOrder(
    borrowPosition.token,
    borrowPosition.maturity,
    1,
    borrowPosition.amount,
    borrowPosition.price
  );

  // swap token A to token B only for gas calculation

  // createOrder for token B to lend
  const lendingPosition = bestArbitrageOpportunity.lendPosition;
  const lendingPositionAddress =
    await lendingControllerContract.getLendingMarket(
      lendingPosition.token,
      lendingPosition.maturity
    );

  const lendingPositionContract = new ethers.Contract(
    lendingPositionAddress,
    LendingMarketABI.default.abi,
    signer
  );

  // function depositAndCreateOrder(bytes32 _ccy, uint256 _maturity, enum ProtocolTypes.Side _side, uint256 _amount, uint256 _unitPrice) external payable returns (bool)
  lendingPositionContract.depositAndCreateOrder(
    lendingPosition.token,
    lendingPosition.maturity,
    0,
    lendingPosition.amount,
    lendingPosition.price
  );

  // DONE!
};

main();
