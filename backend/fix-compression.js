import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pkgPath = path.join(__dirname, 'node_modules/@solana/spl-account-compression/package.json');

if (fs.existsSync(pkgPath)) {
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    
    // Replace the incorrect paths
    if (pkg.main && pkg.main.includes('dist/cjs/index.js')) {
      pkg.main = pkg.main.replace('dist/cjs/index.js', 'dist/cjs/src/index.js');
    }
    if (pkg.module && pkg.module.includes('dist/cjs/index.js')) {
      pkg.module = pkg.module.replace('dist/cjs/index.js', 'dist/cjs/src/index.js');
    }
    if (pkg.exports && pkg.exports['.']) {
      const exp = pkg.exports['.'];
      if (exp.require && exp.require.includes('dist/cjs/index.js')) {
        exp.require = exp.require.replace('dist/cjs/index.js', 'dist/cjs/src/index.js');
      }
      if (exp.import && exp.import.includes('dist/cjs/index.js')) {
        exp.import = exp.import.replace('dist/cjs/index.js', 'dist/cjs/src/index.js');
      }
    }
    
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
    console.log('✅ Successfully patched @solana/spl-account-compression package.json');
  } catch (err) {
    console.error('❌ Failed to patch @solana/spl-account-compression:', err);
  }
} else {
  console.log('⚠️ @solana/spl-account-compression package.json not found');
}
