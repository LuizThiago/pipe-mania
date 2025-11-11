// Jest setup file for browser APIs in Node environment

// Extend globalThis interface for test mocks
interface GlobalWithMocks {
  requestAnimationFrame: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame: (id: number) => void;
}

// Mock requestAnimationFrame
(globalThis as unknown as typeof globalThis & GlobalWithMocks).requestAnimationFrame = (callback: FrameRequestCallback) => {
  return setTimeout(() => callback(Date.now()), 0) as unknown as number;
};

// Mock cancelAnimationFrame
(globalThis as unknown as typeof globalThis & GlobalWithMocks).cancelAnimationFrame = (id: number) => {
  clearTimeout(id);
};

