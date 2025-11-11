import { createPixiApp } from '@pixijs/app';
import { inject } from '@vercel/analytics';

// Initialize Vercel Analytics
inject();

const mount = document.getElementById('app');
if (!mount) throw new Error('Container #app not found');

createPixiApp(mount).then(app => {
  console.log('Pixi loaded', app);
});
