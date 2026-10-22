import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';import {Decoder,Stream} from '@garmin/fitsdk';
const script=new URL('../../convert-deo-to-fit.mjs',import.meta.url).pathname,data=new URL('../../DATA/',import.meta.url).pathname;
function run(input,output){return spawnSync(process.execPath,[script,input,output],{encoding:'utf8',env:{...process.env,TZ:'Europe/Vienna'}});}
function report(dir){const names=fs.readdirSync(dir).filter(n=>n.startsWith('conversion-report-')).sort();return JSON.parse(fs.readFileSync(path.join(dir,names.at(-1))));}
test('batch converts corpus, preserves directories, validates output, skips on rerun',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'deo-batch-'));
 try{const output=path.join(tmp,'FIT');const r=run(data,output);assert.equal(r.status,0,r.stderr);assert.deepEqual(report(output).summary,{found:34,converted:34,skipped:0,errors:0});
 const target=path.join(output,'FLITZI','20080828_173052_FLITZI.fit'),before=fs.readFileSync(target),d=new Decoder(Stream.fromBuffer(before));assert.equal(d.checkIntegrity(),true);const decoded=d.read();assert.deepEqual(decoded.errors,[]);assert.equal(decoded.messages.recordMesgs.length,7892);assert.equal(decoded.messages.sessionMesgs[0].startTime.toISOString(),'2008-08-28T15:30:52.000Z');
 assert.equal(run(data,output).status,0);assert.deepEqual(report(output).summary,{found:34,converted:0,skipped:34,errors:0});assert.deepEqual(fs.readFileSync(target),before);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
test('continues after malformed/undated files; skips links and nested output; handles spaces',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'deo batch '));
 try{const input=path.join(tmp,'input'),output=path.join(input,'FIT');fs.mkdirSync(input);const good=fs.readFileSync(path.join(data,'FLITZI/20080828_173052_FLITZI.DEO'));fs.writeFileSync(path.join(input,'20080828_173052_OK.deo'),good);fs.writeFileSync(path.join(input,'20080828_173052_BROKEN.DEO'),'bad');fs.writeFileSync(path.join(input,'no-date.DEO'),good);fs.symlinkSync(input,path.join(input,'loop'));
 const r=run(input,output);assert.equal(r.status,1);assert.deepEqual(report(output).summary,{found:3,converted:1,skipped:0,errors:2});assert.equal(fs.readdirSync(output).some(n=>n.endsWith('.tmp')),false);
 fs.writeFileSync(path.join(output,'20080828_173052_IGNORE.DEO'),good);assert.equal(run(input,output).status,1);assert.equal(report(output).summary.found,3);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
