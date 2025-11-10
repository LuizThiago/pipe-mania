import type { QueueView } from '../QueueView';
import type { GameController } from '@core/controller/GameController';
import type { GhostController } from './GhostController';

export class QueueAnimator {
  constructor(
    private readonly queueView: QueueView,
    private readonly game: GameController,
    private readonly ghost: GhostController
  ) {}

  private ongoingAnimation: Promise<void> | null = null;

  isAnimating(): boolean {
    return this.ongoingAnimation !== null;
  }

  attach() {
    this.game.onBeforeQueueShift = async () => {
      if (this.ongoingAnimation) return;
      const target = this.ghost.getTargetPositionInContentRoot();
      if (!target) return;
      this.game.setInputEnabled(false);
      this.ghost.hide();

      // Start flight and store the full chained promise so awaiters include cleanup.
      this.ongoingAnimation = this.queueView
        .flyFirstTo(target)
        .catch(() => {
          // Ignore errors; cleanup still runs
        })
        .finally(() => {
          this.ghost.show();
          this.game.setInputEnabled(true);
          this.ongoingAnimation = null;
        });
    };
  }
  async detach() {
    this.game.onBeforeQueueShift = undefined;
    const pending = this.ongoingAnimation;
    if (pending) {
      try {
        await pending;
      } catch {
        // Swallow errors so detach always completes cleanly
      }
    }
  }
}
