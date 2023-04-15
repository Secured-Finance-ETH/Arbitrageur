import { Signer, ethers, encodeBytes32String, BigNumberish, Provider } from "ethers";
import { BN as BigNumber } from 'bn.js';

import * as LendingMarketControllerABI from "../contractABI/LendingMarketController.json"
import * as LendingMarketABI from "../contractABI/LendingMarket.json"
import * as TokenVaultABI from "../contractABI/TokenVault.json"


export class GasEstimator {
  private lendingMarketControllerContract: ethers.Contract;
  private tokenVaultContract: ethers.Contract;

  constructor(private readonly provider: Provider) {
    this.lendingMarketControllerContract = new ethers.Contract(
      LendingMarketControllerABI.default.address,
      LendingMarketControllerABI.default.abi,
      provider
    );

    this.tokenVaultContract = new ethers.Contract(
      TokenVaultABI.default.address,
      TokenVaultABI.default.abi,
      provider
    );
  

  }

  // TODO: Implement this method
  public async estimateSwapFees() {
    return BigInt(0)
  }

  public async estimateLendingFee() {
    const gasLending = await this.provider.estimateGas({
      to: LendingMarketABI.default.address,
      data: this.lendingMarketControllerContract.interface.encodeFunctionData("depositAndCreateOrder", [
        encodeBytes32String("USDC"),
        new BigNumber(Math.floor(Date.now() / 1000)),
        0,
        new BigNumber(0),
        new BigNumber(0),
      ])
    })

    // Additional 20% to be safe
    return gasLending * BigInt(1.2);
  }

  /**
   * Only an estimate of the gas cost of borrowing a token
   * Not to be used in production before trade
   */
  public async estimateBorrowingFee(): Promise<bigint> {
    const gasDeposit = await this.provider.estimateGas({
      to: TokenVaultABI.default.address,
      data: this.tokenVaultContract.interface.encodeFunctionData("deposit", [encodeBytes32String("USDC"), 1])
    })
    
    const createDepositGas = await this.provider.estimateGas({
      to: LendingMarketControllerABI.default.address,
      data: this.lendingMarketControllerContract.interface.encodeFunctionData("createOrder", [
        encodeBytes32String("USDC"),
        new BigNumber(Math.floor(Date.now() / 1000)),
        1,
        new BigNumber(0),
        new BigNumber(0),
      ])

    })

    // Additional 20% to be safe
    return (gasDeposit + createDepositGas) * BigInt(1.2);
  }
}

