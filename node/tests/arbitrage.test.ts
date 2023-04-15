//@ts-ignore 
import { ArbitrageEngine, Order, PositionType } from '../arbitrage';
import { BN as BigNumber } from 'bn.js'

describe('ArbitrageEngine', () => {
  describe('calculateArbitrageOpportunities', () => {
    it('should calculate arbitrage opportunities for a single maturity date with two positions that have a profitable price differential', () => {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      const engine = new ArbitrageEngine(true);
      const positions: Array<Order> = [
        { token: {  name: "ETH" }, posType: PositionType.BORROW, price: new BigNumber(90), amount: new BigNumber(50), maturity: new BigNumber(nextWeek.getTime() / 1000) },
        { token: {  name: "EFIL" }, posType: PositionType.LEND, price: new BigNumber(80), amount: new BigNumber(90), maturity: new BigNumber(nextWeek.getTime() / 1000) },
      ];
      engine.calculateArbitrageOpportunities(positions);
      const opportunities = engine.arbitrageOpportunities;
      console.log(opportunities)

      expect(Object.keys(opportunities).length).toBe(1);

      Object.entries(opportunities).forEach(([key, value]) => {
        expect((value as Array<unknown>).length).toBe(1);

        expect(value[0].borrowPosition.token.name).toStrictEqual("ETH");
        expect(value[0].lendPosition.token.name).toStrictEqual("EFIL");
        expect(value[0].profit.gt(new BigNumber(0))).toStrictEqual(true);
      })
    });

    // it('should handle a single position with no profitable arbitrage opportunity', () => {
    //   const engine = new ArbitrageEngine();
    //   const positions = [
    //     new Position("TokenA", PositionType.BORROW, new BigNumber(10), new BigNumber(100), new Date("2023-05-01")),
    //   ];
    //   engine.calculateArbitrageOpportunities(positions);
    //   const opportunities = engine.arbitrageOpportunities["2023-05-01"];
    //   expect(opportunities.length).toBe(0);
    // });

    // it('should handle multiple maturity dates with multiple positions', () => {
    //   const engine = new ArbitrageEngine();
    //   const positions = [
    //     new Position("TokenA", PositionType.BORROW, new BigNumber(10), new BigNumber(100), new Date("2023-05-01")),
    //     new Position("TokenB", PositionType.LEND, new BigNumber(10), new BigNumber(90), new Date("2023-05-01")),
    //     new Position("TokenA", PositionType.BORROW, new BigNumber(10), new BigNumber(120), new Date("2023-06-01")),
    //     new Position("TokenB", PositionType.LEND, new BigNumber(10), new BigNumber(110), new Date("2023-06-01")),
    //     new Position("TokenC", PositionType.BORROW, new BigNumber(10), new BigNumber(50), new Date("2023-07-01")),
    //     new Position("TokenD", PositionType.LEND, new BigNumber(10), new BigNumber(40), new Date("2023-07-01")),
    //   ];
    //   engine.calculateArbitrageOpportunities(positions);
    //   expect(Object.keys(engine.arbitrageOpportunities)).toEqual(["2023-05-01", "2023-06-01", "2023-07-01"]);
    //   expect(engine.arbitrageOpportunities["2023-05-01"].length).toBe(1);
    //   expect(engine.arbitrageOpportunities["2023-06-01"].length).toBe(1);
    //   expect(engine.arbitrageOpportunities["2023-07-01"].length).toBe(0);
    // });
  });
});
