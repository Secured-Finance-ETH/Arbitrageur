import _ from "lodash";
import BigNumber from "bn.js";
import axios from "axios";

export enum PositionType {
  BORROW = 0,
  LEND = 1,
}

export interface Token {
  name: string; // bytes32
}

export interface Order {
  token: Token;
  price: BigNumber;
  // Maturity date is uint256 in the contract, but we can use BigNumberish to represent it
  maturity: BigNumber;
  posType: PositionType;
  // Amount of tokens in wei
  amount: BigNumber;
}

export interface ArbitrageOpportunity {
  borrowPosition: Order;
  lendPosition: Order;
  profit: BigNumber;
}

type CalcArbitrageParams = {
  borrowGasFee: BigNumber;
  lendGasFee: BigNumber;
  swapFee: BigNumber;
};

type Coin = {
  id: string;
  name: string;
};

const sleep = async (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(() => resolve(), ms));
};

export class ArbitrageEngine {
  private _arbitrageOpportunities: Record<string, ArbitrageOpportunity[]> = {};

  private static readonly SUPPORTED_TOKENS: Array<Coin> = [
    { id: "ETH".toUpperCase(), name: "ETH" },
    { id: "FIL".toUpperCase(), name: "EFIL" },
    { id: "BTC".toUpperCase(), name: "WBTC" },
    { id: "USDC".toUpperCase(), name: "USDC" },
  ];

  private tokenPricesInUsd: Record<string, number>;

  // TODO: Receive a list of tokens to calculate arbitrage opportunities as input
  constructor(isDebug: boolean = false) {

    if (isDebug) {
      this.tokenPricesInUsd = {
        'ETH': 1,
        'EFIL': 1,
        'WBTC': 1,
        'USDC': 1,
      }
    } else {
      this.fetchTokenPrices(ArbitrageEngine.SUPPORTED_TOKENS);
    }
  }

  protected parseInput(): Array<Order> {
    return [];
  }

  public get arbitrageOpportunities(): Record<string, ArbitrageOpportunity[]> {
    return this._arbitrageOpportunities;
  }

  private async fetchTokenPrices(coins: Coin[]): Promise<void> {
    while (true) {
      for (const coin of coins) {
<<<<<<< Updated upstream
        const { data } = await axios.get(`https://api.binance.com/api/v3/ticker/price/?symbol=${coin.id}USDT`);
        console.log(`Fetched price for ${coin.name}: ${data.price}`)
=======
        const { data } = await axios.get(
          `https://api.binance.com/api/v3/ticker/price/?symbol=${coin.id}USDT`
        );
>>>>>>> Stashed changes
        this.tokenPricesInUsd[coin.name] = parseFloat(data.price);
      }
      await sleep(1000 * 60 * 5);
    }
  }

  /**
   * Creates order
   */
  private createOrder() {}

  /**
   * Calculates arbitrage opportunities for a single maturity date
   * @param positions
   * @returns Array of arbitrage opportunities
   */
  private _calculateArbitrageOpportunity(
    positions: Order[],
    params: CalcArbitrageParams = {
      borrowGasFee: new BigNumber(0),
      lendGasFee: new BigNumber(0),
      swapFee: new BigNumber(0),
    }
  ): Array<ArbitrageOpportunity> {
    const arbitrageOpportunities: Array<ArbitrageOpportunity> = [];

    const [borrowPositions, lendPositions] = _.partition(
      positions,
      (pos) => pos.posType === PositionType.BORROW
    );

    // Iterate through every borrow position
    borrowPositions.forEach((borrowPosition) => {
      // Iterate through every lend position
      lendPositions.forEach((lendPosition) => {
        // Skip if the tokens are the same
        if (borrowPosition.token.name === lendPosition.token.name) {
          return;
        }

        // In crypto "unit" is the smallest denomination of a token (1/100)
        const priceDifferential = borrowPosition.price.sub(lendPosition.price);
        const totalPriceDifferential = priceDifferential.mul(
          borrowPosition.amount
        );

        // Depends on gas price, but we can assume it's 1 gwei
        const dexSwapFee = params.swapFee;

        // Calculate based on "borrow" + "lend" amounts
        const borrowGasFees = params.borrowGasFee;
        const lendGasFees = params.lendGasFee;

        const profit = totalPriceDifferential
          .sub(dexSwapFee)
          .sub(borrowGasFees)
          .sub(lendGasFees);

        // If we can borrow the token at a lower price than we can lend it, we have an arbitrage opportunity
        if (profit.gt(new BigNumber(0))) {
          arbitrageOpportunities.push({
            borrowPosition,
            lendPosition,
            profit,
          });
        }
      });
    });

    // Sort by profit (descending order)
    arbitrageOpportunities.sort((a, b) => b.profit.cmp(a.profit));

    return arbitrageOpportunities;
  }

  /**
   * Calculates arbitrage opportunities for each maturity date
   * Takes gas fees into account
   * @param positions Array of positions
   * @returns Record of maturity date to array of arbitrage opportunities
   */
  public calculateArbitrageOpportunities(positions: Order[]): void {
    const positionsByMaturity = _.groupBy(positions, (pos) =>
      pos.maturity.toString()
    );

    // Iterate through every maturity date
    Object.entries(positionsByMaturity).forEach(
      ([maturity, sameMaturityPositions]) => {
        this.arbitrageOpportunities[maturity] =
          this._calculateArbitrageOpportunity(sameMaturityPositions);
      }
    );
  }

  public execute() {
    // "depositAndCreatorOrder"
    // "createOrder"
  }
}
