import test from 'node:test';
import assert from 'node:assert/strict';
import {mapPosition,assignFaces,validRange} from '../src/tracking.js';
test('calibrated coordinates clamp at edges and invert for projection',()=>{
 const r={min:.2,max:.8};assert.equal(mapPosition(0,r),0);assert.equal(mapPosition(1,r),1);assert.ok(Math.abs(mapPosition(.5,r)-.5)<1e-10);assert.equal(mapPosition(.2,r,true),1);assert.equal(mapPosition(.8,r,true),0);
});
test('rejects insufficient and absent calibration data',()=>{assert.equal(validRange({min:.4,max:.45}),false);assert.equal(validRange({}),false);assert.equal(validRange({min:.2,max:.8}),true);});
test('initial crew assignment is mirrored left to right, independent of detection order',()=>{
 const tracks=[{seen:0},{seen:0}];assignFaces(tracks,[{x:.8,y:.4},{x:.2,y:.4}],1000);assert.equal(tracks[0].x,.2);assert.equal(tracks[1].x,.8);
});
test('one visible face cannot control both defenders',()=>{
 const tracks=[{x:.2,y:.4,seen:1000,vx:0},{x:.8,y:.4,seen:1000,vx:0}];assignFaces(tracks,[{x:.75,y:.4}],1050);assert.equal(tracks[0].seen,1000);assert.equal(tracks[1].seen,1050);
});
test('association follows motion instead of detector ordering',()=>{
 const tracks=[{x:.2,y:.4,seen:1000,vx:0},{x:.8,y:.4,seen:1000,vx:0}];assignFaces(tracks,[{x:.74,y:.4},{x:.25,y:.4}],1100);assert.equal(tracks[0].x,.25);assert.equal(tracks[1].x,.74);
});
test('reacquires a face after a long absence at a different position',()=>{
 const tracks=[{x:.1,y:.4,seen:1000,vx:0}];assignFaces(tracks,[{x:.8,y:.4}],3000);assert.equal(tracks[0].x,.8);
});
test('a missing second player does not steal the first player’s face',()=>{
 const tracks=[{x:.2,y:.4,seen:1000,vx:0},{x:.5,y:.5,seen:0,vx:0}];assignFaces(tracks,[{x:.21,y:.4}],1050);assert.equal(tracks[0].seen,1050);assert.equal(tracks[1].seen,0);
});
