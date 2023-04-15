import _ from 'lodash'
import BigNumber from 'bn.js'
 
enum PositionType {
  BORROW = 0,
  LEND = 1,
} 

interface Token {
  name: string; // bytes32
}

interface Position {
  token: Token;
  price: BigNumber;
  // Maturity date is uint256 in the contract, but we can use BigNumberish to represent it
  maturity: BigNumber;
  posType: PositionType;
  // Amount of tokens in wei
  amount: BigNumber;
}

interface ArbitrageOpportunity {
  borrowPosition: Position;
  lendPosition: Position;
  profit: BigNumber;
}

class ArbitrageEngine {
  constructor() {}

  /**
   * Calculates arbitrage opportunities for a single maturity date
   * @param positions 
   * @returns Array of arbitrage opportunities
   */
  private _calculateArbitrageOpportunity(positions: Position[]): Array<ArbitrageOpportunity> {
    const arbitrageOpportunities: Array<ArbitrageOpportunity> = []

    const [borrowPositions, lendPositions] = _.partition(positions, pos => pos.posType === PositionType.BORROW);

    // Iterate through every borrow position
    borrowPositions.forEach(borrowPosition => {
      // Iterate through every lend position
      lendPositions.forEach(lendPosition => {

        // Skip if the tokens are the same
        if (borrowPosition.token.name === lendPosition.token.name) {
          return;
        }

        // In USD 
        const priceDifferential = borrowPosition.price.sub(lendPosition.price);
        
        // Depends on gas price, but we can assume it's 1 gwei
        const dexSwapFee = new BigNumber(3);
        
        // Calculate based on "borrow" + "lend" amounts
        const borrowGasFees = new BigNumber(10);
        const lendGasFees = new BigNumber(10);
        
        const profit = priceDifferential.sub(dexSwapFee).sub(borrowGasFees).sub(lendGasFees);

        // If we can borrow the token at a lower price than we can lend it, we have an arbitrage opportunity
        if (profit.gt(new BigNumber(0))) {
          arbitrageOpportunities.push({ 
            borrowPosition,
            lendPosition,
            profit,
          });
        }
      })
    })

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
  public calculateArbitrageOpportunities(positions: Position[]): Record<string, ArbitrageOpportunity[]> {
    const positionsByMaturity = _.groupBy(positions, pos => pos.maturity.toString());

    const arbitrageOpportunities: Record<string, Array<ArbitrageOpportunity>> = {};

    // Iterate through every maturity date
    Object.entries(positionsByMaturity).forEach(([maturity, sameMaturityPositions]) => {
      const arbitrageOpportunities = this._calculateArbitrageOpportunity(sameMaturityPositions);
      arbitrageOpportunities[maturity] = arbitrageOpportunities;
    })

    return arbitrageOpportunities;
  }

}



