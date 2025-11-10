// Deterministic seeded RNG (Mulberry32)
// I got it at: https://medium.com/@modos.m98/creating-a-seeded-random-string-generator-in-javascript-3165aae1c2d5
// Returns a function compatible with RNG = () => number in [0,1)
export function createSeededRng(seed: number): () => number {
  let a = seed >>> 0 || 0;
  return function () {
    // mulberry32 algorithm
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Utility to derive a numeric seed from strings
export function hashStringToSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
