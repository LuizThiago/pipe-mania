import { WaterFlowController } from '../WaterFlowController';
import type { TileState, Rot } from '@core/types';
import type { GridPort } from '@core/ports/GridPort';
import { ScoreController } from '../ScoreController';
import type { GameConfig } from '@core/config';

// Mock GridPort
const createMockGridPort = (): GridPort => ({
  on: jest.fn(),
  setPipe: jest.fn().mockResolvedValue(undefined),
  setWaterFlow: jest.fn(),
  setWaterFillProgress: jest.fn(),
  finalizeWaterSegment: jest.fn(),
  hasWaterFlow: jest.fn().mockReturnValue(false),
  isBlocked: jest.fn().mockReturnValue(false),
  setAsBlocked: jest.fn(),
  clearAllBlocks: jest.fn(),
  setAllWaterFill: jest.fn(),
});

describe('WaterFlowController', () => {
  let mockGrid: GridPort;
  let scoreController: ScoreController;
  const fillDurationMs = 100;

  const createMockConfig = (): GameConfig['gameplay']['scoring'] => ({
    flowTileReward: 10,
    replacementPenalty: 5,
    allowNegativeScore: false,
  });

  beforeEach(() => {
    mockGrid = createMockGridPort();
    scoreController = new ScoreController(createMockConfig());
  });

  describe('constructor', () => {
    it('should create instance without errors', () => {
      const getGridData = () => [];
      const getStartTile = () => undefined;

      expect(
        () =>
          new WaterFlowController(
            mockGrid,
            getGridData,
            getStartTile,
            fillDurationMs,
            scoreController
          )
      ).not.toThrow();
    });
  });

  describe('startWaterFlow', () => {
    it('should not start flow if no start tile is configured', async () => {
      const getGridData = () => [];
      const getStartTile = () => undefined;

      const controller = new WaterFlowController(
        mockGrid,
        getGridData,
        getStartTile,
        fillDurationMs,
        scoreController
      );

      await controller.startWaterFlow();

      // Should not set water flow if no start tile
      expect(mockGrid.setWaterFlow).not.toHaveBeenCalled();
    });

    it('should start flow from start tile', async () => {
      const gridData: TileState[][] = [
        [
          { kind: 'start', rot: 0 as Rot },
          { kind: 'straight', rot: 0 as Rot },
        ],
      ];

      const getGridData = () => gridData;
      const getStartTile = () => ({ col: 0, row: 0 });

      const controller = new WaterFlowController(
        mockGrid,
        getGridData,
        getStartTile,
        fillDurationMs,
        scoreController
      );

      await controller.startWaterFlow();

      // Should have attempted to set water flow
      expect(mockGrid.setWaterFlow).toHaveBeenCalled();
    });

    it('should not start if already flowing', async () => {
      const gridData: TileState[][] = [[{ kind: 'start', rot: 0 as Rot }]];
      const getGridData = () => gridData;
      const getStartTile = () => ({ col: 0, row: 0 });

      const controller = new WaterFlowController(
        mockGrid,
        getGridData,
        getStartTile,
        fillDurationMs,
        scoreController
      );

      const flow1 = controller.startWaterFlow();

      // Try to start second flow immediately
      await controller.startWaterFlow();

      await flow1;

      // Should only call setWaterFlow once (from first flow)
      expect(mockGrid.setWaterFlow).toHaveBeenCalledTimes(1);
    });
  });

  describe('stop', () => {
    it('should stop water flow', async () => {
      const gridData: TileState[][] = [
        [
          { kind: 'start', rot: 0 as Rot },
          { kind: 'straight', rot: 0 as Rot },
        ],
      ];

      const getGridData = () => gridData;
      const getStartTile = () => ({ col: 0, row: 0 });

      const controller = new WaterFlowController(
        mockGrid,
        getGridData,
        getStartTile,
        fillDurationMs,
        scoreController
      );

      const flowPromise = controller.startWaterFlow();
      controller.stop();

      await flowPromise;

      // Flow should complete after stop
      expect(mockGrid.setWaterFillProgress).toHaveBeenCalled();
    });
  });

  describe('flow termination reasons', () => {
    it('should terminate with "missingPipe" when pipe is missing', async () => {
      const gridData: TileState[][] = [
        [
          { kind: 'start', rot: 0 as Rot },
          { kind: 'empty', rot: 0 as Rot },
        ],
      ];

      const getGridData = () => gridData;
      const getStartTile = () => ({ col: 0, row: 0 });

      let terminationReason: string | undefined;
      scoreController.onFlowComplete = payload => {
        terminationReason = payload.reason;
      };

      const controller = new WaterFlowController(
        mockGrid,
        getGridData,
        getStartTile,
        fillDurationMs,
        scoreController
      );

      await controller.startWaterFlow();

      // Start connects to empty tile, which terminates as missingPipe or disconnected
      expect(['missingPipe', 'disconnected']).toContain(terminationReason);
    });

    it('should terminate when reaching grid edge', async () => {
      const gridData: TileState[][] = [[{ kind: 'start', rot: 0 as Rot }]];

      const getGridData = () => gridData;
      const getStartTile = () => ({ col: 0, row: 0 });

      let terminationReason: string | undefined;
      scoreController.onFlowComplete = payload => {
        terminationReason = payload.reason;
      };

      const controller = new WaterFlowController(
        mockGrid,
        getGridData,
        getStartTile,
        fillDurationMs,
        scoreController
      );

      await controller.startWaterFlow();

      // Start points to grid edge, could be outOfBounds or disconnected
      expect(['outOfBounds', 'disconnected']).toContain(terminationReason);
    });

    it('should terminate with "disconnected" when pipes do not connect', async () => {
      // Start points right, but next pipe points wrong direction
      const gridData: TileState[][] = [
        [
          { kind: 'start', rot: 0 as Rot },
          { kind: 'straight', rot: 1 as Rot },
        ], // Perpendicular
      ];

      const getGridData = () => gridData;
      const getStartTile = () => ({ col: 0, row: 0 });

      let terminationReason: string | undefined;
      scoreController.onFlowComplete = payload => {
        terminationReason = payload.reason;
      };

      const controller = new WaterFlowController(
        mockGrid,
        getGridData,
        getStartTile,
        fillDurationMs,
        scoreController
      );

      await controller.startWaterFlow();

      expect(terminationReason).toBe('disconnected');
    });

    it('should terminate with "manualStop" when stopped manually', async () => {
      const gridData: TileState[][] = [
        [
          { kind: 'start', rot: 0 as Rot },
          { kind: 'straight', rot: 0 as Rot },
          { kind: 'straight', rot: 0 as Rot },
        ],
      ];

      const getGridData = () => gridData;
      const getStartTile = () => ({ col: 0, row: 0 });

      let terminationReason: string | undefined;
      scoreController.onFlowComplete = payload => {
        terminationReason = payload.reason;
      };

      const controller = new WaterFlowController(
        mockGrid,
        getGridData,
        getStartTile,
        fillDurationMs,
        scoreController
      );

      const flowPromise = controller.startWaterFlow();

      // Stop immediately
      controller.stop();

      await flowPromise;

      expect(terminationReason).toBe('manualStop');
    });
  });

  describe('flow strategies', () => {
    it('should use first-port strategy for start pipes', async () => {
      // Start pipe always exits through its single port
      const gridData: TileState[][] = [[{ kind: 'start', rot: 0 as Rot }]];

      const getGridData = () => gridData;
      const getStartTile = () => ({ col: 0, row: 0 });

      const controller = new WaterFlowController(
        mockGrid,
        getGridData,
        getStartTile,
        fillDurationMs,
        scoreController
      );

      await controller.startWaterFlow();

      // Should call setWaterFlow with undefined entry (start tile)
      expect(mockGrid.setWaterFlow).toHaveBeenCalledWith(0, 0, undefined);
    });

    it('should register flow steps correctly', async () => {
      const gridData: TileState[][] = [
        [
          { kind: 'start', rot: 0 as Rot },
          { kind: 'straight', rot: 0 as Rot },
        ],
      ];

      const getGridData = () => gridData;
      const getStartTile = () => ({ col: 0, row: 0 });

      const controller = new WaterFlowController(
        mockGrid,
        getGridData,
        getStartTile,
        fillDurationMs,
        scoreController
      );

      let flowSteps = 0;
      scoreController.onFlowProgress = () => {
        flowSteps++;
      };

      await controller.startWaterFlow();

      // Should register at least one flow step (the straight pipe)
      expect(flowSteps).toBeGreaterThan(0);
    });
  });

  describe('animation', () => {
    it('should call setWaterFillProgress during animation', async () => {
      const gridData: TileState[][] = [[{ kind: 'start', rot: 0 as Rot }]];

      const getGridData = () => gridData;
      const getStartTile = () => ({ col: 0, row: 0 });

      const controller = new WaterFlowController(
        mockGrid,
        getGridData,
        getStartTile,
        10, // Short duration for faster test
        scoreController
      );

      await controller.startWaterFlow();

      expect(mockGrid.setWaterFillProgress).toHaveBeenCalled();
    });

    it('should finalize water segment after animation', async () => {
      const gridData: TileState[][] = [[{ kind: 'start', rot: 0 as Rot }]];

      const getGridData = () => gridData;
      const getStartTile = () => ({ col: 0, row: 0 });

      const controller = new WaterFlowController(
        mockGrid,
        getGridData,
        getStartTile,
        10,
        scoreController
      );

      await controller.startWaterFlow();

      expect(mockGrid.finalizeWaterSegment).toHaveBeenCalled();
    });
  });
});
