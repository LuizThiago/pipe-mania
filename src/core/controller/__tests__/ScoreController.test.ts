import { ScoreController } from '../ScoreController';
import type { GameConfig } from '@core/config';

describe('ScoreController', () => {
  const createMockConfig = (
    overrides?: Partial<GameConfig['gameplay']['scoring']>
  ): GameConfig['gameplay']['scoring'] => ({
    flowTileReward: 10,
    replacementPenalty: 5,
    allowNegativeScore: false,
    ...overrides,
  });

  describe('constructor', () => {
    it('should initialize with score of 0', () => {
      const config = createMockConfig();
      const controller = new ScoreController(config);

      expect(controller.getScore()).toBe(0);
    });

    it('should initialize with target flow length of 1', () => {
      const config = createMockConfig();
      const controller = new ScoreController(config);

      expect(controller.getTargetFlowLength()).toBe(1);
    });
  });

  describe('handlePipePlacement', () => {
    it('should not change score when placing new pipe', () => {
      const config = createMockConfig();
      const controller = new ScoreController(config);

      controller.handlePipePlacement({ wasReplacement: false });

      expect(controller.getScore()).toBe(0);
    });

    it('should apply penalty when replacing existing pipe', () => {
      const config = createMockConfig({ replacementPenalty: 5, allowNegativeScore: true });
      const controller = new ScoreController(config);

      controller.handlePipePlacement({ wasReplacement: true });

      expect(controller.getScore()).toBe(-5);
    });

    it('should not go below 0 when allowNegativeScore is false', () => {
      const config = createMockConfig({
        replacementPenalty: 10,
        allowNegativeScore: false,
      });
      const controller = new ScoreController(config);

      controller.handlePipePlacement({ wasReplacement: true });

      expect(controller.getScore()).toBe(0);
    });

    it('should allow negative score when allowNegativeScore is true', () => {
      const config = createMockConfig({
        replacementPenalty: 10,
        allowNegativeScore: true,
      });
      const controller = new ScoreController(config);

      controller.handlePipePlacement({ wasReplacement: true });

      expect(controller.getScore()).toBe(-10);
    });
  });

  describe('flow management', () => {
    describe('beginFlow', () => {
      it('should reset flow distance to 0', () => {
        const config = createMockConfig();
        const controller = new ScoreController(config);

        // Simulate previous flow
        controller.beginFlow();
        controller.registerFlowStep({ tile: { col: 0, row: 0 }, kind: 'straight' });
        controller.completeFlow('noExit');

        // Begin new flow
        controller.beginFlow();

        // Progress should be reset
        let progressEmitted = -1;
        controller.onFlowProgress = progress => {
          progressEmitted = progress;
        };

        expect(progressEmitted).toBe(0);
      });
    });

    describe('registerFlowStep', () => {
      it('should increase score by flowTileReward', () => {
        const config = createMockConfig({ flowTileReward: 10 });
        const controller = new ScoreController(config);

        controller.beginFlow();
        controller.registerFlowStep({ tile: { col: 0, row: 0 }, kind: 'straight' });

        expect(controller.getScore()).toBe(10);
      });

      it('should not register steps if flow is not active', () => {
        const config = createMockConfig({ flowTileReward: 10 });
        const controller = new ScoreController(config);

        controller.registerFlowStep({ tile: { col: 0, row: 0 }, kind: 'straight' });

        expect(controller.getScore()).toBe(0);
      });

      it('should count multiple steps correctly', () => {
        const config = createMockConfig({ flowTileReward: 10 });
        const controller = new ScoreController(config);

        controller.beginFlow();
        controller.registerFlowStep({ tile: { col: 0, row: 0 }, kind: 'straight' });
        controller.registerFlowStep({ tile: { col: 1, row: 0 }, kind: 'curve' });
        controller.registerFlowStep({ tile: { col: 2, row: 0 }, kind: 'cross' });

        expect(controller.getScore()).toBe(30);
      });

      it('should respect max visits for cross pipes', () => {
        const config = createMockConfig({ flowTileReward: 10 });
        const controller = new ScoreController(config);

        controller.beginFlow();

        const tile = { col: 0, row: 0 };

        // Cross pipe allows 2 visits
        controller.registerFlowStep({ tile, kind: 'cross' });
        controller.registerFlowStep({ tile, kind: 'cross' });
        controller.registerFlowStep({ tile, kind: 'cross' }); // Should be ignored

        expect(controller.getScore()).toBe(20); // Only 2 visits counted
      });

      it('should respect max visits for regular pipes (1 visit)', () => {
        const config = createMockConfig({ flowTileReward: 10 });
        const controller = new ScoreController(config);

        controller.beginFlow();

        const tile = { col: 0, row: 0 };

        controller.registerFlowStep({ tile, kind: 'straight' });
        controller.registerFlowStep({ tile, kind: 'straight' }); // Should be ignored

        expect(controller.getScore()).toBe(10); // Only 1 visit counted
      });

      it('should emit progress updates', () => {
        const config = createMockConfig();
        const controller = new ScoreController(config);

        const progressUpdates: number[] = [];
        controller.onFlowProgress = progress => {
          progressUpdates.push(progress);
        };

        controller.beginFlow();
        controller.registerFlowStep({ tile: { col: 0, row: 0 }, kind: 'straight' });
        controller.registerFlowStep({ tile: { col: 1, row: 0 }, kind: 'straight' });

        expect(progressUpdates).toContain(1);
        expect(progressUpdates).toContain(2);
      });
    });

    describe('completeFlow', () => {
      it('should emit flow completion with correct payload', () => {
        const config = createMockConfig();
        const controller = new ScoreController(config);
        controller.setTargetFlowLength(3);

        let completionPayload: any = null;
        controller.onFlowComplete = payload => {
          completionPayload = payload;
        };

        controller.beginFlow();
        controller.registerFlowStep({ tile: { col: 0, row: 0 }, kind: 'straight' });
        controller.registerFlowStep({ tile: { col: 1, row: 0 }, kind: 'straight' });
        controller.completeFlow('noExit');

        expect(completionPayload).toBeTruthy();
        expect(completionPayload.reason).toBe('noExit');
        expect(completionPayload.totalTraversed).toBe(2);
        expect(completionPayload.targetLength).toBe(3);
        expect(completionPayload.goalAchieved).toBe(false);
      });

      it('should mark goal as achieved when target is met', () => {
        const config = createMockConfig();
        const controller = new ScoreController(config);
        controller.setTargetFlowLength(2);

        let completionPayload: any = null;
        controller.onFlowComplete = payload => {
          completionPayload = payload;
        };

        controller.beginFlow();
        controller.registerFlowStep({ tile: { col: 0, row: 0 }, kind: 'straight' });
        controller.registerFlowStep({ tile: { col: 1, row: 0 }, kind: 'straight' });
        controller.completeFlow('outOfBounds');

        expect(completionPayload.goalAchieved).toBe(true);
      });

      it('should not complete flow if not active', () => {
        const config = createMockConfig();
        const controller = new ScoreController(config);

        let completionCalled = false;
        controller.onFlowComplete = () => {
          completionCalled = true;
        };

        // Don't call beginFlow()
        controller.completeFlow('noExit');

        expect(completionCalled).toBe(false);
      });
    });
  });

  describe('target flow length', () => {
    it('should update target flow length', () => {
      const config = createMockConfig();
      const controller = new ScoreController(config);

      controller.setTargetFlowLength(10);

      expect(controller.getTargetFlowLength()).toBe(10);
    });

    it('should floor non-integer values', () => {
      const config = createMockConfig();
      const controller = new ScoreController(config);

      controller.setTargetFlowLength(7.8);

      expect(controller.getTargetFlowLength()).toBe(7);
    });

    it('should enforce minimum of 1', () => {
      const config = createMockConfig();
      const controller = new ScoreController(config);

      controller.setTargetFlowLength(0);

      expect(controller.getTargetFlowLength()).toBe(1);
    });

    it('should ignore invalid values', () => {
      const config = createMockConfig();
      const controller = new ScoreController(config);

      controller.setTargetFlowLength(5);
      controller.setTargetFlowLength(NaN);

      expect(controller.getTargetFlowLength()).toBe(5); // Unchanged
    });
  });

  describe('score management', () => {
    it('should reset score to 0', () => {
      const config = createMockConfig({ flowTileReward: 10 });
      const controller = new ScoreController(config);

      controller.beginFlow();
      controller.registerFlowStep({ tile: { col: 0, row: 0 }, kind: 'straight' });

      expect(controller.getScore()).toBe(10);

      controller.resetScore();

      expect(controller.getScore()).toBe(0);
    });

    it('should emit score update on reset', () => {
      const config = createMockConfig();
      const controller = new ScoreController(config);

      const scoreUpdates: number[] = [];
      controller.onScoreChange = score => {
        scoreUpdates.push(score);
      };

      controller.resetScore();

      expect(scoreUpdates).toContain(0);
    });
  });

  describe('event listeners', () => {
    it('should call onScoreChange when score updates', () => {
      const config = createMockConfig({ flowTileReward: 10 });
      const controller = new ScoreController(config);

      const scores: number[] = [];
      controller.onScoreChange = score => {
        scores.push(score);
      };

      controller.beginFlow();
      controller.registerFlowStep({ tile: { col: 0, row: 0 }, kind: 'straight' });

      expect(scores).toContain(10);
    });

    it('should emit current score when listener is attached', () => {
      const config = createMockConfig({ flowTileReward: 10 });
      const controller = new ScoreController(config);

      controller.beginFlow();
      controller.registerFlowStep({ tile: { col: 0, row: 0 }, kind: 'straight' });

      let emittedScore = -1;
      controller.onScoreChange = score => {
        emittedScore = score;
      };

      expect(emittedScore).toBe(10);
    });

    it('should emit current progress when listener is attached', () => {
      const config = createMockConfig();
      const controller = new ScoreController(config);

      controller.beginFlow();
      controller.registerFlowStep({ tile: { col: 0, row: 0 }, kind: 'straight' });

      let emittedProgress = -1;
      controller.onFlowProgress = progress => {
        emittedProgress = progress;
      };

      expect(emittedProgress).toBe(1);
    });
  });
});
