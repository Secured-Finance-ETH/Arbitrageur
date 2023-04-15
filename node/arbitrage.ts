import _ from 'lodash'
import BigNumber from 'bn.js'
import axios from 'axios'
 
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
}

type Coin = {
  id: string
  name: string
}

const sleep = async (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(() => resolve(), ms))
}

export class ArbitrageEngine {
  private _arbitrageOpportunities: Record<string, ArbitrageOpportunity[]> = {};

  private static readonly SUPPORTED_TOKENS: Array<Coin> = [
    { id: 'ETH'.toUpperCase(), name: 'ETH' },
    { id: 'FIL'.toUpperCase(), name: 'EFIL' },
    { id: 'BTC'.toUpperCase(), name: 'WBTC' },
    { id: 'USDC'.toUpperCase(), name: 'USDC' },
  ]

  private tokenPricesInUsd: Record<string, number>

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
    return []
  }

  public get arbitrageOpportunities(): Record<string, ArbitrageOpportunity[]> {
    return this._arbitrageOpportunities;
  } 


  private async fetchTokenPrices (coins: Coin[]): Promise<void> {
    while (true) {  
      for (const coin of coins) {
        const { data } = await axios.get(`https://api.binance.com/api/v3/ticker/price/?symbol=${coin.id}USDT`);
        console.log(`Fetched price for ${coin.name}: ${data.price}`)
        this.tokenPricesInUsd[coin.name] = parseFloat(data.price);
      }
      await sleep(1000 * 60 * 5)
    } 
  }

  /**
   * Creates order
   */
  private createOrder() {}


  private yearToFraction(maturity: number): number {
    const oneDayInSeconds = 24 * 60 * 60; // number of seconds in one day
    const nowInSeconds = Math.floor(Date.now() / 1000); // current time in seconds
    const secondsToMaturity = maturity - nowInSeconds; // number of seconds between now and maturity
    const daysToMaturity = Math.ceil(secondsToMaturity / oneDayInSeconds); // round up to get number of days

    return daysToMaturity / 365;
  }

  /**
   * Converts a loan price to a rate
   * @returns rate in basis points
   */
  private calculateRate(price: number, maturity: number) {
    const PAR_VALUE = 10000;
    const PAR_VALUE_RATE = 1000000;
    
    return ((PAR_VALUE / price - 1) / this.yearToFraction(maturity)) * PAR_VALUE_RATE;
  }

  /**
   * Calculates arbitrage opportunities for a single maturity date
   * @param positions
   * @returns Array of arbitrage opportunities
   */
  private _calculateArbitrageOpportunity(positions: Order[], params: CalcArbitrageParams = { 
    borrowGasFee: new BigNumber(0),
    lendGasFee: new BigNumber(0),
    swapFee: new BigNumber(0),
  }): Array<ArbitrageOpportunity> {
    const arbitrageOpportunities: Array<ArbitrageOpportunity> = []

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
        const borrowPositionRate = this.calculateRate(borrowPosition.price.toNumber(), borrowPosition.maturity.toNumber());
        const lendPositionRate = this.calculateRate(lendPosition.price.toNumber(), lendPosition.maturity.toNumber());

        const rateDifferential = lendPositionRate - borrowPositionRate;

        if (rateDifferential < 0) {
          return;
        }

        const carryTradeAmount = rateDifferential * borrowPosition.amount.toNumber();
        const carryTradeAmountInUsd = carryTradeAmount * this.tokenPricesInUsd[borrowPosition.token.name];

        // const maxAmountInLendToken = this.tokenPricesInUsd[lendPosition.token.name] * lendPosition.amount.toNumber();
        
        // Depends on gas price, but we can assume it's 1 gwei
        const dexSwapFee = params.swapFee; 
      
        // Calculate based on "borrow" + "lend" amounts
        const borrowGasFees = params.borrowGasFee;
        const lendGasFees = params.lendGasFee;
        
        const profit = new BigNumber(carryTradeAmountInUsd).sub(dexSwapFee).sub(borrowGasFees).sub(lendGasFees);

        // If we can borrow the token at a lower price than we can lend it, we have an arbitrage opportunity
        if (profit.lt(new BigNumber(0))) {
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
