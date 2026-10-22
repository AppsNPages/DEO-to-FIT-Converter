import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {publishFile} from '../src/publish-file.js';
const fail=code=>Object.assign(new Error(code),{code});
test('unsupported hardlinks fall back to copy without overwriting existing files',async()=>{
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'deo-publish-'));try{
 const source=path.join(tmp,'temp'),dest=path.join(tmp,'ride.fit');await fs.writeFile(source,'complete FIT bytes');
 for(const code of ['ENOTSUP','EOPNOTSUPP','ENOSYS','EXDEV','EPERM']){
 const io={link:async()=>{throw fail(code);},copyFile:fs.copyFile};await publishFile(source,dest,io);assert.equal(await fs.readFile(dest,'utf8'),'complete FIT bytes');await fs.writeFile(dest,'existing');await assert.rejects(publishFile(source,dest,io),{code:'EEXIST'});assert.equal(await fs.readFile(dest,'utf8'),'existing');await fs.unlink(dest);
 }
 }finally{await fs.rm(tmp,{recursive:true,force:true});}
});
test('normal hardlink path and unrelated failures do not trigger a copy',async()=>{
 let copied=false;const io={link:async()=>{},copyFile:async()=>{copied=true;}};await publishFile('a','b',io);assert.equal(copied,false);
 for(const code of ['EEXIST','EACCES','ENOENT','ENOSPC']){io.link=async()=>{throw fail(code);};await assert.rejects(publishFile('a','b',io),{code});assert.equal(copied,false);}
});
test('copy errors propagate to batch error reporting',async()=>{await assert.rejects(publishFile('a','b',{link:async()=>{throw fail('ENOTSUP');},copyFile:async()=>{throw fail('ENOSPC');}}),{code:'ENOSPC'});});
