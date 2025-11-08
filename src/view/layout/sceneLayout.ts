import type { GameConfig } from '@core/config';

type GridLayoutRect = {
  contentWidth: number;
  contentHeight: number;
  outerWidth: number;
  outerHeight: number;
  padding: number;
  gap: number;
};

type QueueLayoutRect = {
  contentWidth: number;
  contentHeight: number;
  outerWidth: number;
  outerHeight: number;
  padding: number;
};

type LayoutPositions = {
  gridPosition: { x: number; y: number };
  queuePosition: { x: number; y: number };
};

export type SceneLayout = {
  gridRect: GridLayoutRect;
  queueRect: QueueLayoutRect;
  gridPosition: LayoutPositions['gridPosition'];
  queuePosition: LayoutPositions['queuePosition'];
};

export function calculateSceneLayout(
  tileSize: number,
  grid: GameConfig['grid'],
  queue: GameConfig['queue'],
  visibleTiles: number
): SceneLayout {
  const slots = Math.max(1, Math.min(queue.queueSize ?? visibleTiles, visibleTiles));
  const gridRect = calculateGridRect(tileSize, grid);
  const queueRect = calculateQueueRect(tileSize, grid, queue, slots);
  const { gridPosition, queuePosition } = calculatePositions(
    gridRect,
    queueRect,
    queue.queueTopMargin ?? 16
  );

  return {
    gridRect,
    queueRect,
    gridPosition,
    queuePosition,
  };
}

function calculateGridRect(tileSize: number, grid: GameConfig['grid']): GridLayoutRect {
  const gap = grid.tileGap ?? 0;
  const padding = grid.backgroundPadding ?? 0;

  const contentWidth = grid.cols * tileSize + (grid.cols - 1) * gap;
  const contentHeight = grid.rows * tileSize + (grid.rows - 1) * gap;

  return {
    contentWidth,
    contentHeight,
    outerWidth: contentWidth + padding * 2,
    outerHeight: contentHeight + padding * 2,
    padding,
    gap,
  };
}

function calculateQueueRect(
  tileSize: number,
  grid: GameConfig['grid'],
  queue: GameConfig['queue'],
  visibleTiles: number
): QueueLayoutRect {
  const padding = grid.backgroundPadding ?? 0;
  const queueGap = queue.queueGap ?? 0;
  const queueSize = visibleTiles;

  const contentWidth = queueSize * tileSize + (queueSize - 1) * queueGap;
  const contentHeight = tileSize;

  return {
    contentWidth,
    contentHeight,
    outerWidth: contentWidth + padding * 2,
    outerHeight: contentHeight + padding * 2,
    padding,
  };
}

function calculatePositions(
  gridRect: GridLayoutRect,
  queueRect: QueueLayoutRect,
  topMargin: number
): LayoutPositions {
  const totalHeight = gridRect.outerHeight + topMargin + queueRect.outerHeight;
  const top = -totalHeight / 2;

  const gridCenterX = 0;
  const queueCenterX = gridCenterX + (gridRect.outerWidth - queueRect.outerWidth) / 2;

  const gridCenterY = top + gridRect.outerHeight / 2;
  const queueCenterY =
    gridCenterY + gridRect.outerHeight / 2 + topMargin + queueRect.outerHeight / 2;

  return {
    gridPosition: { x: gridCenterX, y: gridCenterY },
    queuePosition: { x: queueCenterX, y: queueCenterY },
  };
}
