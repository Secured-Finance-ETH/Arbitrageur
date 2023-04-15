import * as dotenv from "dotenv";
dotenv.config();

import { ethers } from "ethers";
import * as CurrencyControllerABI from "../contractABI/CurrencyController.json" assert { type: "json" };
import * as LendingMarketControllerABI from "../contractABI/LendingMarketController.json" assert { type: "json" };
import * as LendingMarketABI from "../contractABI/LendingMarket.json" assert { type: "json" };

const main = async () => {
  const network = process.env.ETHEREUM_NETWORK;
  const provider = new ethers.InfuraProvider(
    network,
    process.env.INFURA_API_KEY
  );

  // Creating a signing account from a private key
  // const signer = new ethers.Wallet(process.env.SIGNER_PRIVATE_KEY, provider);
  const currencyContract = new ethers.Contract(
    CurrencyControllerABI.default.address,
    CurrencyControllerABI.default.abi
  );

  const currencies = currencyContract.getCurrencies();

  // get list of currency rpc call
  for (const currency in currencies) {
    const lendingControllerContract = new ethers.Contract(
      LendingMarketControllerABI.default.address,
      LendingMarketControllerABI.default.abi
    );

    // for each currency, call getLendingMarkets -> return address[]
    const contractAddresses =
      lendingControllerContract.getLendingMarkets(currency);

    // for each address contract, call getMaturity, getBorrowUnitPrice, getLendUnitPrice, corresponding maturity
    for (const contractAddress in contractAddresses) {
      const lendingMarketContract = new ethers.Contract(
        LendingMarketABI.default.address,
        LendingMarketABI.default.abi
      );
      const maturity = lendingMarketContract.getMaturity();
      const borrowUnitPrice = lendingMarketContract.getBorrowUnitPrice();
      const lendingUnitPrice = lendingMarketContract.getLendUnitPrice();
    }
  }

  // construct data of input for algortihm to run

  // alforithm to run -> get token A to borrow and token B to lend at the same maturity

  // createOrder for token A to borrow

  // swap token A to token B using 1 inch

  // createOrder for token B to lend
};

// // Creating and sending the transaction object
// const tx = await signer.sendTransaction({
//   to: "<to_account>",
//   value: ethers.utils.parseUnits("0.001", "ether"),
// });

// const receipt = await tx.wait();

main();
