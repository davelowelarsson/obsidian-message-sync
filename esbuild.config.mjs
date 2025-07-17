import esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isProd = process.env.NODE_ENV === 'production';
const isWatch = process.argv.includes('--watch');

// Read the base manifest
const baseManifest = JSON.parse(readFileSync('./manifest.json', 'utf8'));

// Create development and production manifests
const devManifest = {
  ...baseManifest,
  id: 'obsidian-message-sync-dev',
  name: 'Message Sync (Dev)',
  version: `${baseManifest.version}-dev`,
  description: `${baseManifest.description} (Development Version)`
};

const prodManifest = {
  ...baseManifest
};

// Choose the appropriate manifest
const manifest = isProd ? prodManifest : devManifest;

// Ensure dist directory exists
mkdirSync('./dist', { recursive: true });

// Write the manifest to the dist directory
writeFileSync('./dist/manifest.json', JSON.stringify(manifest, null, 2));

// Copy styles.css to dist directory
import { copyFileSync } from 'fs';
try {
  copyFileSync('./styles.css', './dist/styles.css');
  console.log('📄 Copied styles.css to dist/');
} catch (error) {
  console.warn('⚠️  styles.css not found, skipping copy');
}

const config = {
  entryPoints: ['src/plugin/main.ts'],
  bundle: true,
  external: [
    'obsidian',
    'electron',
    '@codemirror/autocomplete',
    '@codemirror/collab',
    '@codemirror/commands',
    '@codemirror/language',
    '@codemirror/lint',
    '@codemirror/search',
    '@codemirror/state',
    '@codemirror/view',
    '@lezer/common',
    '@lezer/highlight',
    '@lezer/lr'
  ],
  format: 'cjs',
  target: 'es2018',
  logLevel: 'info',
  sourcemap: isProd ? false : 'inline',
  treeShaking: true,
  outfile: 'dist/main.js',
  minify: isProd,
  loader: {
    '.js': 'jsx',
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(isProd ? 'production' : 'development'),
  },
  plugins: [
    {
      name: 'obsidian-plugin-builder',
      setup(build) {
        build.onEnd((result) => {
          if (result.errors.length > 0) {
            console.error('Build failed with errors:', result.errors);
            return;
          }

          console.log(`✅ Build completed successfully`);
          console.log(`📦 Mode: ${isProd ? 'Production' : 'Development'}`);
          console.log(`🎯 Plugin ID: ${manifest.id}`);
          console.log(`📋 Manifest: dist/manifest.json`);
          console.log(`🔧 Main file: dist/main.js`);

          if (!isProd) {
            console.log(`\n📝 Development Build Notes:`);
            console.log(`   - Use symlink: ln -s ${join(__dirname, 'dist')} ~/.obsidian/plugins/${manifest.id}`);
            console.log(`   - Or copy files to: ~/.obsidian/plugins/${manifest.id}/`);
            console.log(`   - Remember to refresh plugins in Obsidian settings`);
          }
        });
      }
    }
  ]
};

if (isWatch) {
  console.log('👀 Starting development build with watch mode...');
  const context = await esbuild.context(config);
  await context.watch();
} else {
  console.log(`🚀 Building plugin for ${isProd ? 'production' : 'development'}...`);
  await esbuild.build(config);
}
