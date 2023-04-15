
import { ethers } from 'ethers'
import currencyController from '../contractABI/CurrencyController.json'

const main = async () => {
  const network = process.env.ETHEREUM_NETWORK;
  const provider = new ethers.InfuraProvider(
    network,
    process.env.INFURA_API_KEY
  );

  // Creating a signing account from a private key
  const signer = new ethers.Wallet(process.env.SIGNER_PRIVATE_KEY, provider);

  const currencyContract = new ethers.Contract(currencyController.address, currencyController.abi)

  const currencies = currencyContract.getCurrencies()


  console.log("currencies" , currencies)
  
  // get list of currency rpc call

  // for each currency, call getLendingMarkets -> return address[]

  // for each address contract, call getMaturity, getBorrowUnitPrice, getLendUnitPrice

  // construct data of input for algortihm to run

  // alforithm to run -> get token A to borrow and token B to lend at the same maturity

  // createOrder for token A to borrow

  // swap token A to token B using 1 inch

  // createOrder for token B to lend

  
}

// // Creating and sending the transaction object
// const tx = await signer.sendTransaction({
//   to: "<to_account>",
//   value: ethers.utils.parseUnits("0.001", "ether"),
// });

// const receipt = await tx.wait();


main();