import { BigNumberish } from "ethers";

enum PositionType {
  BORROW = 0,
  LEND = 1,
} 

type Token = {
  name: string; // bytes32
}

interface Position {
  token: Token;
  amount: BigNumberish;
  // Maturity date is uint256 in the contract, but we can use BigNumberish to represent it
  maturity: BigNumberish;
  posType: PositionType;
}

function findArbitrage(positions: Position[]): void {
  // TODO: Group by maturity date with lodash
  for (let i = 0; i < positions.length; i++) {
    const borrowPosition = positions[i];
    for (let j = 0; j < positions.length; j++) {
      if (i === j) { // not same token
        continue;
      }
      const lendPosition = positions[j];

      
    }
  }
}
