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

  return app;
}
