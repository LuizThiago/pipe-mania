import { Scene } from '@view/Scene';
import { Application } from 'pixi.js';

export async function createPixiApp(mount: HTMLElement) {
  const app = new Application();
  await app.init({
    resizeTo: window,
    background: '#FAFAFA',
  });
  mount.appendChild(app.canvas as HTMLCanvasElement);

  const scene = new Scene();
  app.stage.addChild(scene);
  setupSceneAutoCenter(app, scene);

  return app;
}

function setupSceneAutoCenter(app: Application, scene: Scene) {
  let lastWidth = 0;
  let lastHeight = 0;

  const updateScenePosition = () => {
    const { width, height } = app.screen;
    if (width === lastWidth && height === lastHeight) {
      return;
    }
    lastWidth = width;
    lastHeight = height;
    scene.onViewportResize(width, height);
  };

  updateScenePosition();

  // Subscribe the updateScenePosition function to the app's ticker for "auto-centering" the game grid.
  app.ticker.add(updateScenePosition);
}
