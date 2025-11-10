import {
  getBasePorts,
  getMaxFlowVisits,
  getFlowStrategy,
  getPipeAssetPath,
  getRandomizablePipeKinds,
  PIPE_DEFINITIONS,
} from '../pipeDefinitions';
import type { PipeKind } from '../pipeDefinitions';

describe('pipeDefinitions', () => {
  describe('getBasePorts', () => {
    it('should return correct ports for all pipe types', () => {
      expect(getBasePorts('empty')).toEqual([]);
      expect(getBasePorts('straight')).toEqual(['left', 'right']);
      expect(getBasePorts('curve')).toEqual(['right', 'bottom']);
      expect(getBasePorts('cross')).toEqual(['top', 'right', 'bottom', 'left']);
      expect(getBasePorts('start')).toEqual(['right']);
    });
  });

  describe('getMaxFlowVisits', () => {
    it('should return correct max visits for each type', () => {
      expect(getMaxFlowVisits('empty')).toBe(0);
      expect(getMaxFlowVisits('straight')).toBe(1);
      expect(getMaxFlowVisits('curve')).toBe(1);
      expect(getMaxFlowVisits('cross')).toBe(2);
      expect(getMaxFlowVisits('start')).toBe(0);
    });
  });

  describe('getFlowStrategy', () => {
    it('should return correct strategy for critical types', () => {
      expect(getFlowStrategy('straight')).toBe('any-available');
      expect(getFlowStrategy('curve')).toBe('any-available');
      expect(getFlowStrategy('cross')).toBe('straight-through');
      expect(getFlowStrategy('start')).toBe('first-port');
    });
  });

  describe('getPipeAssetPath', () => {
    it('should return correct asset paths', () => {
      expect(getPipeAssetPath('straight')).toBe('/assets/pipes/straight-pipe.png');
      expect(getPipeAssetPath('curve')).toBe('/assets/pipes/curved-pipe.png');
      expect(getPipeAssetPath('cross')).toBe('/assets/pipes/cross-pipe.png');
    });
  });

  describe('getRandomizablePipeKinds', () => {
    it('should return only randomizable pipes', () => {
      const randomizable = getRandomizablePipeKinds();

      expect(randomizable).toHaveLength(3);
      expect(randomizable).toContain('straight');
      expect(randomizable).toContain('curve');
      expect(randomizable).toContain('cross');
      expect(randomizable).not.toContain('empty');
      expect(randomizable).not.toContain('start');
    });
  });

  describe('PIPE_DEFINITIONS structure', () => {
    it('should have all required properties', () => {
      const requiredProps = [
        'kind',
        'displayName',
        'ports',
        'assetPath',
        'randomizable',
        'maxFlowVisits',
        'flowStrategy',
      ];

      Object.keys(PIPE_DEFINITIONS).forEach(key => {
        const def = PIPE_DEFINITIONS[key as PipeKind];
        requiredProps.forEach(prop => {
          expect(def).toHaveProperty(prop);
        });
      });
    });

    it('should have valid flow strategies', () => {
      const validStrategies = ['first-port', 'straight-through', 'any-available'];

      Object.keys(PIPE_DEFINITIONS).forEach(key => {
        const def = PIPE_DEFINITIONS[key as PipeKind];
        expect(validStrategies).toContain(def.flowStrategy);
      });
    });
  });
});
