import * as dotenv from "dotenv";
dotenv.config();

import { ethers } from "ethers";
import * as CurrencyControllerABI from "../contractABI/CurrencyController.json";
import * as LendingMarketControllerABI from "../contractABI/LendingMarketController.json";
import * as LendingMarketABI from "../contractABI/LendingMarket.json";

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
      const borrowUnitPrice = await lendingMarketContract.getBorrowUnitPrice();
      const lendingUnitPrice = await lendingMarketContract.getLendUnitPrice();
      console.log("maturity ", maturity, "borrowUnitPrice ", borrowUnitPrice, "lendingUnitPrice ", lendingUnitPrice);
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
