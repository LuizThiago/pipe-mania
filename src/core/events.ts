import type { TileView } from '@view/TileView';

// Events for TileView
export type TileClickedPayload = { col: number; row: number };
export type TileViewEvents = {
  'tile:click': [TileClickedPayload];
};

// Events for GridView
export type GridTileSelectedPayload = { col: number; row: number; tile: TileView };
export type GridViewEvents = {
  'grid:tileSelected': [GridTileSelectedPayload];
};
