import { getPorts } from '../pipes';
import type { PipeKind, Rot, Dir } from '@core/types';

describe('pipes', () => {
  describe('getPorts', () => {
    describe('start pipe', () => {
      it('should return single exit port at right when rotation is 0', () => {
        const result = getPorts('start', 0 as Rot);
        expect(result).toEqual(['right']);
      });

      it('should return single exit port at bottom when rotation is 1', () => {
        const result = getPorts('start', 1 as Rot);
        expect(result).toEqual(['bottom']);
      });

      it('should return single exit port at left when rotation is 2', () => {
        const result = getPorts('start', 2 as Rot);
        expect(result).toEqual(['left']);
      });

      it('should return single exit port at top when rotation is 3', () => {
        const result = getPorts('start', 3 as Rot);
        expect(result).toEqual(['top']);
      });
    });

    describe('straight pipe', () => {
      it('should return left and right ports when rotation is 0', () => {
        const result = getPorts('straight', 0 as Rot);
        expect(result).toHaveLength(2);
        expect(result).toContain('left');
        expect(result).toContain('right');
      });

      it('should return top and bottom ports when rotation is 1', () => {
        const result = getPorts('straight', 1 as Rot);
        expect(result).toHaveLength(2);
        expect(result).toContain('top');
        expect(result).toContain('bottom');
      });

      it('should return same ports for 180° rotation', () => {
        const rot0 = getPorts('straight', 0 as Rot);
        const rot2 = getPorts('straight', 2 as Rot);
        // Rotation by 180° should give same result (left-right remains left-right)
        expect(rot0.sort()).toEqual(rot2.sort());
      });
    });

    describe('curve pipe', () => {
      it('should return right and bottom ports when rotation is 0', () => {
        const result = getPorts('curve', 0 as Rot);
        expect(result).toHaveLength(2);
        expect(result).toContain('right');
        expect(result).toContain('bottom');
      });

      it('should return bottom and left ports when rotation is 1', () => {
        const result = getPorts('curve', 1 as Rot);
        expect(result).toHaveLength(2);
        expect(result).toContain('bottom');
        expect(result).toContain('left');
      });

      it('should return left and top ports when rotation is 2', () => {
        const result = getPorts('curve', 2 as Rot);
        expect(result).toHaveLength(2);
        expect(result).toContain('left');
        expect(result).toContain('top');
      });

      it('should return top and right ports when rotation is 3', () => {
        const result = getPorts('curve', 3 as Rot);
        expect(result).toHaveLength(2);
        expect(result).toContain('top');
        expect(result).toContain('right');
      });
    });

    describe('cross pipe', () => {
      it('should return all four directions regardless of rotation', () => {
        const allDirections: Dir[] = ['top', 'right', 'bottom', 'left'];

        // Cross pipe should always have all 4 ports
        for (let rot = 0; rot < 4; rot++) {
          const result = getPorts('cross', rot as Rot);
          expect(result).toHaveLength(4);
          allDirections.forEach(dir => {
            expect(result).toContain(dir);
          });
        }
      });
    });

    describe('edge cases', () => {
      it('should handle all pipe kinds without errors', () => {
        const pipeKinds: PipeKind[] = ['start', 'straight', 'curve', 'cross'];
        const rotations: Rot[] = [0, 1, 2, 3];

        pipeKinds.forEach(kind => {
          rotations.forEach(rot => {
            expect(() => getPorts(kind, rot)).not.toThrow();
            const result = getPorts(kind, rot);
            expect(result).toBeTruthy();
            expect(Array.isArray(result)).toBe(true);
          });
        });
      });
    });
  });
});
