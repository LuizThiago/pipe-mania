import { PipesQueue } from '../pipesQueue';
import { createSeededRng } from '@core/rng';

describe('PipesQueue', () => {
  const mockRng = () => 0.5;
  const allowedPipes = ['straight', 'curve', 'cross'] as const;

  describe('constructor', () => {
    it('should create queue with valid configuration', () => {
      const queue = new PipesQueue(5, mockRng, allowedPipes);
      const snapshot = queue.snapshotPipes();

      expect(snapshot).toHaveLength(5);
      snapshot.forEach(pipe => {
        expect(allowedPipes).toContain(pipe.kind);
        expect(pipe.rot).toBeGreaterThanOrEqual(0);
        expect(pipe.rot).toBeLessThan(4);
      });
    });

    it('should throw error for invalid size', () => {
      expect(() => new PipesQueue(0, mockRng, allowedPipes)).toThrow(
        'Pipes queue size must be >= 1'
      );
    });

    it('should throw error for empty pipes array', () => {
      expect(() => new PipesQueue(3, mockRng, [])).toThrow('Allowed pipes array must not be empty');
    });
  });

  describe('queue operations', () => {
    it('should peek without modifying queue', () => {
      const queue = new PipesQueue(3, mockRng, allowedPipes);
      const snapshot = queue.snapshotPipes();
      const peeked = queue.peekPipe();

      expect(peeked).toEqual(snapshot[0]);
      expect(queue.snapshotPipes()).toEqual(snapshot);
    });

    it('should pop and push maintaining size', () => {
      const queue = new PipesQueue(3, mockRng, allowedPipes);
      const initialSnapshot = queue.snapshotPipes();

      const popped = queue.popAndPushPipe();

      expect(popped).toEqual(initialSnapshot[0]);
      expect(queue.snapshotPipes()).toHaveLength(3);
    });

    it('should reset queue completely', () => {
      const queue = new PipesQueue(3, mockRng, allowedPipes);
      queue.popAndPushPipe();
      queue.reset();

      expect(queue.snapshotPipes()).toHaveLength(3);
    });
  });

  describe('determinism', () => {
    it('should produce deterministic pipes with seeded RNG', () => {
      const queue1 = new PipesQueue(5, createSeededRng(42), allowedPipes);
      const queue2 = new PipesQueue(5, createSeededRng(42), allowedPipes);

      expect(queue1.snapshotPipes()).toEqual(queue2.snapshotPipes());
    });
  });
});
