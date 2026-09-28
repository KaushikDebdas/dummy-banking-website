// GitHub Pages serves 404.html for unknown paths. Making it a copy of index.html lets
// deep links such as /<repo>/customers/CUS-DHK-000002 load the app and route client-side.
import { copyFileSync, existsSync } from 'node:fs';

if (!existsSync('dist/index.html')) {
  console.error('dist/index.html not found - run the build first');
  process.exit(1);
}
copyFileSync('dist/index.html', 'dist/404.html');
console.log('Created dist/404.html for GitHub Pages deep links');
