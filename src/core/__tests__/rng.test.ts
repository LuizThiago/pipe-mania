import { createSeededRng, hashStringToSeed } from '../rng';

describe('rng', () => {
  describe('createSeededRng', () => {
    it('should produce deterministic sequence with same seed', () => {
      const rng1 = createSeededRng(12345);
      const rng2 = createSeededRng(12345);

      const sequence1 = Array.from({ length: 10 }, () => rng1());
      const sequence2 = Array.from({ length: 10 }, () => rng2());

      expect(sequence1).toEqual(sequence2);
    });

    it('should produce different sequences with different seeds', () => {
      const rng1 = createSeededRng(12345);
      const rng2 = createSeededRng(54321);

      const sequence1 = Array.from({ length: 10 }, () => rng1());
      const sequence2 = Array.from({ length: 10 }, () => rng2());

      expect(sequence1).not.toEqual(sequence2);
    });

    it('should return values between 0 and 1', () => {
      const rng = createSeededRng(42);

      for (let i = 0; i < 100; i++) {
        const value = rng();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });

    it('should produce statistically distributed values', () => {
      const rng = createSeededRng(999);
      const samples = Array.from({ length: 1000 }, () => rng());

      const histogram = [0, 0, 0, 0];

      samples.forEach(value => {
        const bucket = Math.floor(value * 4);
        histogram[bucket]++;
      });

      histogram.forEach(count => {
        expect(count).toBeGreaterThan(150);
        expect(count).toBeLessThan(350);
      });
    });
  });

  describe('hashStringToSeed', () => {
    it('should produce consistent hash for same input', () => {
      const hash1 = hashStringToSeed('test-string');
      const hash2 = hashStringToSeed('test-string');

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = hashStringToSeed('string-one');
      const hash2 = hashStringToSeed('string-two');

      expect(hash1).not.toBe(hash2);
    });

    it('should handle edge cases', () => {
      expect(typeof hashStringToSeed('')).toBe('number');
      expect(typeof hashStringToSeed('a'.repeat(1000))).toBe('number');
    });

    it('should produce valid 32-bit unsigned integers', () => {
      const inputs = ['test', 'game', 'seed', 'pipe-mania'];

      inputs.forEach(input => {
        const hash = hashStringToSeed(input);
        expect(hash).toBeGreaterThanOrEqual(0);
        expect(hash).toBeLessThanOrEqual(0xffffffff);
        expect(Number.isInteger(hash)).toBe(true);
      });
    });

    it('should work with createSeededRng', () => {
      const seed = hashStringToSeed('game-stage-1');
      const rng = createSeededRng(seed);
      const value = rng();

      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    });
  });
});
