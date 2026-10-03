import {mkdir,cp,readFile,writeFile,access} from 'node:fs/promises';
await mkdir('public/vendor',{recursive:true});
await mkdir('public/models',{recursive:true});
const bundle=await readFile('node_modules/@mediapipe/tasks-vision/vision_bundle.cjs','utf8');
await writeFile('public/vendor/vision_bundle.js',`self.vision = (() => { const exports = {};\n${bundle}\nreturn exports; })();\n`);
await cp('node_modules/@mediapipe/tasks-vision/wasm','public/vendor/wasm',{recursive:true});
const path='public/models/blaze_face_short_range.tflite';
try {await access(path);} catch {
 const response=await fetch('https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite');
 if(!response.ok)throw new Error(`Model download failed: ${response.status}`);
 await writeFile(path,new Uint8Array(await response.arrayBuffer()));
}
console.log('Local face detector assets ready.');
