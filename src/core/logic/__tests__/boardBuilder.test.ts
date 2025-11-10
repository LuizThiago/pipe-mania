import { buildInitialBoard } from '../boardBuilder';
import { createSeededRng } from '@core/rng';

describe('boardBuilder', () => {
  describe('buildInitialBoard', () => {
    it('should create grid with correct dimensions', () => {
      const { gridData } = buildInitialBoard({
        rows: 5,
        cols: 10,
        blockedTilesPercentage: 0,
        rng: Math.random,
      });

      expect(gridData).toHaveLength(5);
      expect(gridData[0]).toHaveLength(10);
    });

    it('should block correct percentage of tiles', () => {
      const totalTiles = 10 * 10;
      const blockedPercentage = 0.2;
      const expectedBlocked = Math.floor(totalTiles * blockedPercentage);

      const { blockedTiles } = buildInitialBoard({
        rows: 10,
        cols: 10,
        blockedTilesPercentage: blockedPercentage,
        rng: Math.random,
      });

      expect(blockedTiles).toHaveLength(expectedBlocked);
    });

    it('should mark blocked tiles in grid data', () => {
      const { gridData, blockedTiles } = buildInitialBoard({
        rows: 3,
        cols: 3,
        blockedTilesPercentage: 0.3,
        rng: createSeededRng(123),
      });

      blockedTiles.forEach(({ col, row }) => {
        expect(gridData[row][col].blocked).toBe(true);
      });
    });

    it('should produce deterministic results with seeded RNG', () => {
      const params = {
        rows: 5,
        cols: 5,
        blockedTilesPercentage: 0.5,
        rng: createSeededRng(42),
      };

      const board1 = buildInitialBoard(params);
      const board2 = buildInitialBoard({ ...params, rng: createSeededRng(42) });

      expect(board1.gridData).toEqual(board2.gridData);
      expect(board1.blockedTiles).toEqual(board2.blockedTiles);
    });

    it('should not block more than totalTiles - 1', () => {
      const { blockedTiles } = buildInitialBoard({
        rows: 3,
        cols: 3,
        blockedTilesPercentage: 1.0,
        rng: Math.random,
      });

      expect(blockedTiles.length).toBeLessThan(9);
    });

    it('should handle invalid dimensions gracefully', () => {
      const { gridData, blockedTiles } = buildInitialBoard({
        rows: 0,
        cols: 0,
        blockedTilesPercentage: 0,
        rng: Math.random,
      });

      expect(gridData).toEqual([]);
      expect(blockedTiles).toEqual([]);
    });
  });
});
