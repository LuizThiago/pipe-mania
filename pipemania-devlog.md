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
- Overall, it feels like a solid first step: the tiles render cleanly, and I’m starting to get comfortable with Pixi’s rendering model.
