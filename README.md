# Pipe Mania

A modern reimplementation of the classic puzzle game Pipe Mania (also known as Pipe Dream), built with TypeScript and PixiJS.

## About

In Pipe Mania, players must create a continuous pipeline by placing pipe pieces on a grid before water starts flowing. The objective is to keep the water flowing through as many pipes as possible to reach a target length and advance to the next stage. As stages progress, the difficulty increases with more blocked tiles and longer target paths.

## Demo

**[Play the game online →](https://pipemania.luizthiago.com/)**

![Game Preview](public/assets/pipemania.gif)

## Tech Stack

- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe development with strict compilation
- **[PixiJS v8](https://pixijs.com/)** - High-performance 2D WebGL rendering engine
- **[Vite](https://vitejs.dev/)** - Lightning-fast build tool and dev server
- **[Zod](https://zod.dev/)** - Schema validation for game configuration
- **[Jest](https://jestjs.io/)** - Testing framework with TypeScript support
- **ESLint + Prettier** - Code quality and formatting

## Project Structure

```
pipe-mania/
├── src/
│   ├── core/              # Core game logic (framework-agnostic)
│   │   ├── controller/    # Game state controllers
│   │   ├── logic/         # Game algorithms and utilities
│   │   ├── ports/         # Interface contracts
│   │   ├── config.ts      # Configuration schema and validation
│   │   ├── types.ts       # Type definitions
│   │   └── events.ts      # Event system
│   ├── view/              # PixiJS rendering layer
│   │   ├── systems/       # Reusable view systems
│   │   ├── layout/        # Layout calculations
│   │   └── utils/         # View utilities
│   ├── pixi/              # PixiJS app initialization
│   └── main.ts            # Application entry point
└── public/assets/         # Game assets (sprites, textures)
```

## Architecture

The project follows a **clean architecture** pattern with clear separation between core logic and rendering:

### Core Layer (`src/core/`)

Contains all game logic independent of the rendering framework:

- **Controllers**: Manage game state and orchestrate game flow
  - `GameController`: Main game loop, tile placement, stage progression
  - `WaterFlowController`: Handles water animation sequence and pathfinding
  - `ScoreController`: Score calculation, targets, and progression tracking

- **Logic**: Pure functions for game algorithms
  - `boardBuilder`: Generates initial game boards with blocked tiles
  - `pathfinding`: DFS-based algorithm to find longest connected pipe paths
  - `pipes`: Port mapping and rotation logic for pipe connections
  - `pipesQueue`: Manages the queue of upcoming pipe pieces

- **Ports**: Interface contracts (Port/Adapter pattern)
  - `GridPort`: Abstraction layer between controllers and view

### View Layer (`src/view/`)

PixiJS-based rendering implementation:

- **GridView**: Implements `GridPort`, manages the game board display
- **TileView**: Individual tile rendering and interactions
- **TileWaterRenderer**: Complex water animation rendering system
- **QueueView**: Displays upcoming pipe pieces
- **HudView**: Score, target, and timer display
- **EndModalView**: Win/lose modal dialogs

### Systems

Reusable subsystems that coordinate between view and logic:

- **GhostController**: Ghost preview of pipe placement that follows cursor
- **QueueAnimator**: Animates queue transitions when placing pipes

## Key Systems

### 1. Water Flow Animation System

The water animation is one of the most complex parts of the project. It uses **PixiJS Graphics** to dynamically render water flowing through pipes.

**Architecture:**

- Each tile has **two Graphics layers**:
  - `dynamicGraphics`: Renders the current animation
  - `staticGraphics`: Stores finalized water paths

**Why two layers?**
Cross pipes can receive water from multiple directions. When water flows through once, we commit that path to the static layer. If water arrives from another direction later, we reuse the dynamic layer for the new animation without affecting the previous path.

**Animation Algorithm:**

```typescript
// Water animation is split into three segments:
1. Entry Arm: Water enters from the incoming direction
2. Center: Water fills the center junction
   - Straight pipes: Simple linear fill
   - Curved pipes: Animated transition between entry/exit arms
   - Cross pipes: Direct through-flow in the active direction
3. Exit Arm: Water exits toward the next tile

// Total fill length is calculated as:
totalLength = entryArmLength + centerLength + exitArmLength

// Progress is then distributed across segments:
fillLength = progress * totalLength
```

**Geometry Calculations:**
The `TileWaterRenderer` computes precise geometry for each pipe type:

- Edge insets for border spacing
- Channel width for water flow
- Center junction coordinates
- Arm lengths for each direction

**Key Features:**

- Smooth progressive filling using `requestAnimationFrame`
- Configurable fill duration (`fillDurationMs`)
- Proper handling of curves with overlapping entry/exit animations
- Support for bi-directional flow in cross pipes

### 2. Grid System & Tile Management

**GridView** manages the entire game board:

- Creates a 2D array of `TileView` instances
- Handles tile positioning with gaps
- Responsive layout that scales to viewport
- Background panel with rounded corners
- Implements `GridPort` interface for framework-agnostic controllers

**TileView** represents individual tiles:

- Loads and displays pipe sprites
- Manages rotation (0°, 90°, 180°, 270°)
- Contains `TileWaterRenderer` for water animation
- Handles click/tap events for tile selection
- Supports blocked tile states

### 3. Pipe Logic & Pathfinding

**Port System:**
Each pipe type has defined "ports" (connection points):

```typescript
BASE_PORTS = {
  straight: ['left', 'right'],
  curve: ['right', 'bottom'], // L-shaped
  cross: ['top', 'right', 'bottom', 'left'],
  start: ['right'], // Starting piece with one exit
};
```

Rotations are applied by shifting directions clockwise.

**Connection Validation:**
Two adjacent tiles are connected only if:

1. The first tile has a port facing the second
2. The second tile has a port facing back (opposite direction)

This prevents diagonal leakage and ensures proper flow.

**Pathfinding:**
Uses **Depth-First Search (DFS)** to find the longest connected path:

- Explores all possible routes from every tile
- Tracks visited tiles to prevent cycles
- Returns the longest valid path found
- Used for highlighting connected pipe networks

### 4. Water Flow Sequence

The `WaterFlowController` orchestrates the sequential water animation:

```typescript
// Flow algorithm:
1. Start at the start tile
2. Determine exit direction based on pipe rotation
3. Animate water filling the current tile (async)
4. Wait for animation to complete
5. Move to next tile in exit direction
6. Validate connection to next tile
7. Repeat until termination condition
```

**Termination Conditions:**

- `missingPipe`: Next position is empty
- `noExit`: Current pipe has no valid exit
- `outOfBounds`: Flow reached grid boundary
- `disconnected`: Next pipe doesn't connect back
- `manualStop`: Flow was manually stopped

**Cross Pipe Handling:**
Cross pipes track which directions have been used via a `Map<string, Set<Dir>>`:

- Primary flow goes straight through
- If water arrives from an alternate direction, it uses an unused arm
- Prevents infinite loops while allowing bi-directional flow

### 5. Queue System

**Pipe Queue:**

- Fixed-size circular buffer of upcoming pipes
- Seeded random generation for deterministic gameplay
- Shows next N pieces to the player
- Auto-refills when pipes are placed

**QueueAnimator:**
Coordinates smooth queue transitions:

1. Hide ghost preview
2. Animate first item moving to placement position
3. Shift remaining items up in queue
4. Animate new item appearing at the end
5. Show ghost preview again

### 6. Configuration System

Uses **Zod** for runtime validation of game configuration:

```typescript
const config = {
  grid: { cols, rows, tileGap, maxWidthRatio, ... },
  gameplay: {
    allowedPipes: ['straight', 'curve', 'cross'],
    difficulty: {
      blockedPercentStart: 0,
      blockedPercentPerStage: 0.05,
      targetLengthStart: 5,
      targetLengthPerStage: 1,
      ...
    },
    scoring: { flowTileReward, replacementPenalty, ... }
  },
  water: { fillColor, fillDurationMs, autoStartDelayMs, ... },
  animations: { tilePlaceBounceMs, ghostSnapLerp, ... },
  ...
}
```

All config values have defaults and are validated on load. Invalid configs fall back to defaults with console warnings.

### 7. Ghost Preview System

The **GhostController** provides visual feedback for pipe placement:

**Features:**

- Transparent preview tile that follows the cursor
- Snaps to nearest grid cell
- Different lerp speeds inside/outside grid bounds
- Pulsing outline animation for visibility
- Shows the next pipe piece from the queue
- Automatically hides during animations

**Implementation:**

- Uses pointer events on the root container
- Converts global pointer position to grid local space
- Calculates nearest cell and snaps smoothly with lerp
- Renders using the same sprite as the actual tile

## Game Features

- **Progressive Difficulty**: Blocked tiles and target length increase each stage
- **Scoring System**:
  - Earn points for each tile water flows through
  - Penalty for replacing already-placed pipes
  - Optional negative score prevention
- **Auto-start Timer**: Countdown before water automatically starts flowing
- **Responsive Design**: Scales to any screen size
- **Seeded Random Generation**: Deterministic gameplay for reproducible levels
- **Multiple Pipe Types**: Straight, curved, and cross pipes
- **Win/Lose Conditions**: Reach target length to advance or restart on failure

## Getting Started

### Prerequisites

- Node.js 16+ and npm

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/pipe-mania.git
cd pipe-mania

# Install dependencies
npm install
```

### Development

```bash
# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint

# Format code
npm run format

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Testing

The project uses **[Jest](https://jestjs.io/)** with **TypeScript** support for comprehensive unit testing of game logic.

### Test Coverage

- ✅ **80 tests** across 7 test suites (strategically focused)
- ✅ **100% coverage** on critical modules
- ✅ **Deterministic tests** using seeded random generation
- ✅ **Fast execution** (~5 seconds for full suite)

### Tested Areas

**Core Logic (High Priority - 100% coverage):**

- `rng.ts` - Random number generation and seeding (9 tests)
- `pipeDefinitions.ts` - Pipe type definitions and properties (7 tests)
- `pipes.ts` - Pipe rotation and port calculations (13 tests)
- `boardBuilder.ts` - Board generation and blocked tiles (6 tests)
- `pipesQueue.ts` - Queue management and operations (7 tests)

**Controllers (Medium Priority - 80% coverage):**

- `ScoreController.ts` - Scoring, penalties, and flow tracking (25 tests)
- `WaterFlowController.ts` - Water flow sequences and termination (13 tests)

**Not Tested (Intentionally excluded):**

- `GameController.ts` - Complex integration controller (would require extensive mocking)
- `pathfinding.ts` - Recursive DFS algorithm (complex to test, covered by integration)
- View components - Require PixiJS mocking (not cost-effective for unit tests)

### Test Structure

```
src/
└── core/
    ├── __tests__/
    │   └── rng.test.ts
    ├── controller/
    │   └── __tests__/
    │       ├── ScoreController.test.ts
    │       └── WaterFlowController.test.ts
    └── logic/
        └── __tests__/
            ├── boardBuilder.test.ts
            ├── pipeDefinitions.test.ts
            ├── pipes.test.ts
            └── pipesQueue.test.ts
```

### Key Testing Features

- **Mocked Browser APIs**: `requestAnimationFrame` for Node.js environment
- **Seeded RNG**: Deterministic test scenarios for reproducible results
- **Type Safety**: Full TypeScript integration with Jest
- **Isolated Tests**: Each test is independent with clean setup
- **Strategic Coverage**: Focused on critical paths and business logic
- **Fast Feedback**: Complete test suite runs in ~5 seconds

### Testing Philosophy

This project demonstrates **strategic testing** rather than exhaustive coverage. The 80 tests focus on:

1. **Critical Game Logic**: RNG, pipe mechanics, and board generation
2. **Business Rules**: Scoring, flow tracking, and game state management
3. **Edge Cases**: Boundary conditions, error handling, and invalid inputs

**Note for reviewers**: In a production environment, I would maintain this focused approach (~70-80% coverage of critical code) rather than 100% coverage.

## How to Play

1. **Objective**: Connect pipes to create a path for water to flow through
2. **Placement**: Click any empty tile to place the next pipe from the queue
3. **Timer**: Water starts flowing automatically after the countdown
4. **Goal**: Make water flow through at least the target number of tiles
5. **Advance**: Complete the target to progress to the next stage
6. **Difficulty**: Each stage adds more blocked tiles and higher targets

## Configuration

You can customize the game by modifying the config in `Scene.ts` or by passing a config object to `loadConfig()`:

```typescript
const customConfig = {
  grid: { cols: 12, rows: 8 },
  gameplay: {
    allowedPipes: ['straight', 'curve'],
    difficulty: {
      targetLengthStart: 10,
      blockedPercentPerStage: 0.1,
    },
  },
  water: { fillColor: '#ff0000', fillDurationMs: 1500 },
};

const config = loadConfig(customConfig);
```

## Assets

Pipe sprites are located in `public/assets/pipes/`:

- `tile.png` - Empty tile background
- `straight-pipe.png` - Straight pipe piece
- `curved-pipe.png` - L-shaped curved pipe
- `cross-pipe.png` - Four-way cross pipe
- `start-pipe.png` - Starting piece

## Development Notes

### Why PixiJS Graphics Instead of Sprites?

Initially, the water animation used sprite masks, but this approach had issues:

- Hard to control progressive filling
- Masking performance was unpredictable
- Difficult to handle curves smoothly

Switching to **Graphics API** provided:

- Frame-by-frame control over fill progress
- Pixel-perfect rendering
- Better performance
- Full control over animation easing

### Port Pattern

The **GridPort** interface decouples the game logic from PixiJS:

```typescript
interface GridPort {
  setPipe(col, row, kind, rot): Promise<void>;
  setWaterFlow(col, row, entry): void;
  setWaterFillProgress(col, row, progress): void;
  isBlocked(col, row): boolean;
  // ... more methods
}
```

This allows:

- Testing controllers without rendering
- Potential future rendering backends (Canvas, DOM, etc.)
- Clear separation of concerns

## License

This project is open source and available under the MIT License.

## Author

**Luiz Thiago**
