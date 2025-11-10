### November 3, 2025

- Analyzed possible stacks and decided on **Vite + TypeScript + PixiJS + ESLint + Prettier**;
- Created the GitHub repository and set up the initial project with linting and formatting;
- Made the first **tile art sketch** (empty pipe, curve and cross) and defined the base visual style;
- I thought about how to approach the flow of water (dynamic mask using Pixi Graphics sounds the best approach).

### November 4, 2025

- Today I deep dive into **PixiJS**, experimenting with how sprites, anchors, and scaling actually behave in practice.
- Built my first working version of a **TileView**, which can load and display different pipe sprites using `Assets.load`.
- Ran into a few layout and rotation issues, but learned how anchors affect positioning and how to properly center and scale sprites.
- Cleaned up the project setup and fixed path resolution in **Vite + TypeScript** so imports like `@core` and `@view` work correctly.
- Added the real **tile and pipe sprites**, tested them individually, and finally got everything aligned correctly on screen.
- Overall, it feels like a solid first step: the tiles render cleanly, and I'm starting to get comfortable with Pixi's rendering model.

### November 5, 2025

- I set up a **config system with Zod**... It is my first contact with Zod, and looks a good way to add validation for game settings. Now I can easily tweak grid size and gameplay stuff without breaking things.
- Added an **event system** with typed events so tiles and the grid can talk to each other without getting too messy. Clean separation feels good.
- Built the **GridView**. It creates and manages all the tiles automatically. Handles positioning, initialization, and passes click events up the chain.
- I was getting annoying having to update strings in multiple places, so I fixed the pipe types mess. Now `ALL_PIPE_KINDS` lives in constants and everything else derives from it using TypeScript's `Exclude`. Much better, and adding new pipe types will be way easier.
- Added **random piece functions** when you click a tile, it gets a random piece and rotation. Basic but it works, and the types are all safe. It's still not deterministic btw...
- Connected everything in the **Scene** and **GridView** is integrated and tile clicks actually do something now. Starting to feel like a real game.

### November 6, 2025

- I refactored the `Scene`, pulling the gameplay logic into a dedicated **GameController** so the flow lives in one place.
- I introduced **random blocked cells** into the initial board to break up the grid (still planning to seed this for deterministic runs later on).
- Filled in the rest of the placement rules: each tile now keeps track of its kind, rotation, and whether it’s blocked every time I click.
- Built the connection checks using the pipe ports with proper directional mapping and rotation handling.
- Wired up the **longest-path DFS** with visual highlighting so connected routes glow instantly.
- Extracted the initial board setup into a reusable **board builder** that prepares the grid (blocked tiles included) before the controller boots up.
- Introduced a **GridPort interface**, letting the controller talk to the grid through a small contract instead of Pixi internals.
- Updated `GridView` to implement that interface, keeping rendering separate from orchestration.
- Having the **GameController** in place clarified responsibilities across the system, and the link detection logic proved how solid foundations make later features easier to plug in.
- Next up, I’ll probably move toward water feature or score logic, now that the board itself behaves as expected.

### November 8, 2025

- I improved the overall **layout** today. The grid is now properly centered and scales with the window, making the game finally feel balanced on different screen sizes.
- Added the **queue system** that shows the upcoming tiles to the player. It’s a small detail, but it really helps visualize what’s coming next.
- Implemented the **water fill rendering** for pipe tiles. I first tried using sprites with masks, but that approach turned out messy and unreliable. I switched to drawing with **Pixi Graphics**, splitting each fill into three segments (start, middle, end), which gave me full control over how the water expands.
- The **cross tile** caused a nasty problem since it can have two inputs and two outputs, creating loops. I solved it by keeping **two separate water renders**: one dynamic (for animation) and one static (for storing the final filled shape). When an animation finishes, I copy the shape to the static graphic and hide the dynamic one. That way, if new water arrives from another direction, I can reuse the dynamic renderer without touching the old path.
- No doubt, this **water animation system** was the most complex part so far. It took several iterations to get right.
- Also added some randomness: the **start tile** and its **rotation** are now randomized at the beginning of each round.
- Finally, implemented **sequential flow logic**. Now the water spreads through connected tiles in proper order, starting from the start tile, instead of everything animating at once. It looks and feels so much better.

### November 9, 2025

- Today was a packed and satisfying day. I started the morning cleaning things up: removed an old randomization class that was no longer useful, then reorganized `GameController` and `GridView` to streamline the water flow logic. The flow system is clearer now, and it’s finally impossible to replace tiles once the water flow has started, which prevents a ton of inconsistencies.
- Then I moved on to the **scoring system**. I introduced a complete and configurable scoring schema with flow rewards, replacement penalties, target flow length, and even negative scores. The new `ScoreController` now handles all the score logic directly from the `GameController`. It’s a major step that will make balancing the game much easier in the long run.
- Next, I focused on the **HUD**. I added HUD configuration to the game config, including font sizes, margins, and offsets. The game now displays both the score and flow progress dynamically, with real-time updates emitted from the `ScoreController`. It’s a small but impactful visual upgrade that makes the gameplay feel more alive.
- After that, I extracted all water-related logic into a dedicated `WaterFlowController`. This cleanup made things much more readable and modular. The HUD now also shows a countdown timer before the water starts flowing, giving the whole sequence a more dynamic feel.
- I also implemented the **end game modal**, with customizable titles and actions through the config file. When the flow completes, the modal pops up showing the result and a restart option. The `GameController` locks player input while the modal is displayed, and the stage reset now properly clears everything. I added a new `clearAllBlocks` method in `GridView` and a `reset` in `PipesQueue` to refill the pipe queue after a reset. It all works smoothly together.
- The next focus was **difficulty and stage progression**. I introduced a difficulty schema that dynamically adjusts parameters like blocked tile percentages and target flow length based on the current stage. The HUD shows the current stage and flow target in real time, and the `Scene` reacts to stage changes according to the game outcome. It finally feels like there’s a sense of progression and challenge.
- Later in the afternoon, I added **per-stage RNG management** for deterministic runs and implemented a new **animations configuration** in the game config. Tile placement and queue shift animations can now be tuned individually, making transitions feel much smoother. I also improved ghost interactions for better tile placement feedback.

### November 10, 2025

- I woke up at 4 AM with a clear idea in my head: **centralize the creation of pipes**. Until now, adding a new pipe meant touching half a dozen files scattered across the project. It felt messy and error-prone. So, I finally consolidated everything into a single source of truth, `pipeDefinitions.ts`. Now, every pipe type lives in one place, defined cleanly in `PIPE_DEFINITIONS`. This change alone will save me a lot of repetitive work and make extending the system far simpler.
- While doing that, I also **centralized pipe flow strategies**. Each pipe now declares its own flow behavior via a `flowStrategy` property in its definition. I removed all those hardcoded conditionals like `if (kind === 'cross')` from the `WaterFlowController`, which had started to become a mess. Now, there are three main strategies: _first-port_, _straight-through_, and _any-available_. The water flow logic reads beautifully clean now, and adding a new pipe with a unique flow behavior is just a matter of defining it once.
- Later, I worked on **testing and cleanup**. I added Jest testing scripts to the project for unit testing and coverage, updated the TypeScript configuration to include Jest types, and cleaned up old comments in `WaterFlowController` and `pipeDefinitions`. The setup feels more professional now, and I’m finally ready to start validating the core systems through actual tests instead of manual runs.
