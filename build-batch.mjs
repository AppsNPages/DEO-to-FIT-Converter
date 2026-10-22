import {build} from 'esbuild';
await build({entryPoints:[new URL('./src/batch-convert.js',import.meta.url).pathname],outfile:new URL('./convert-deo-to-fit.mjs',import.meta.url).pathname,bundle:true,format:'esm',platform:'node',target:'node18',minify:true,legalComments:'inline'});
console.log('Created standalone convert-deo-to-fit.mjs (no npm installation needed to run).');
