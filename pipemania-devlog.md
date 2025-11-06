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
