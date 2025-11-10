// Jest setup file for browser APIs in Node environment

// Mock requestAnimationFrame
(globalThis as any).requestAnimationFrame = (callback: FrameRequestCallback) => {
  return setTimeout(() => callback(Date.now()), 0) as unknown as number;
};

// Mock cancelAnimationFrame
(globalThis as any).cancelAnimationFrame = (id: number) => {
  clearTimeout(id);
};

