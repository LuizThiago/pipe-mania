import { createPixiApp } from '@pixijs/app';

const mount = document.getElementById('app');
if (!mount) throw new Error('Container #app not found');

createPixiApp(mount).then(app => {
  console.log('Pixi loaded', app);
});
