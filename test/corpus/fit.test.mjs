import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {Decoder,Stream} from '@garmin/fitsdk';import {toFIT,fitStartTime} from '../../web/fit.js';import {parseDEO} from '../../web/deo.js';
process.env.TZ='Europe/Vienna';
const data=new URL('../../DATA/',import.meta.url).pathname;
function read(p){const b=fs.readFileSync(p);return parseDEO(b.buffer.slice(b.byteOffset,b.byteOffset+b.length),path.basename(p));}
function decode(bytes){const d=new Decoder(Stream.fromByteArray(bytes));assert.equal(d.checkIntegrity(),true);const r=d.read();assert.deepEqual(r.errors,[]);return r.messages;}
const start=fitStartTime('2008-08-28T17:30:52');
const fixture=()=>read(path.join(data,'FLITZI/20080828_173052_FLITZI.DEO'));
test('official Garmin decoder validates every supplied ride including units and summaries',()=>{
 const paths=[];function walk(p){for(const e of fs.readdirSync(p,{withFileTypes:true})){const q=path.join(p,e.name);if(e.isDirectory())walk(q);else if(/\.deo$/i.test(q))paths.push(q);}}walk(data);assert.equal(paths.length,34);
 for(const p of paths){const r=read(p),m=decode(toFIT(r,{startDate:start}));assert.equal(m.recordMesgs.length,r.rows.length);assert.equal(m.sessionMesgs[0].sport,'cycling');assert.equal(m.lapMesgs.length,1);assert.equal(m.activityMesgs[0].numSessions,1);assert.equal(m.sessionMesgs[0].totalTimerTime,r.rows.at(-1).time-r.rows[0].time+r.step);
 for(const i of [0,100,r.rows.length-1]){const original=r.rows[i],record=m.recordMesgs[i];assert.equal(record.power,Math.round(original.power));assert.equal(record.heartRate,Math.round(original.heartRate));assert.ok(Math.abs(record.enhancedSpeed-original.speed/3.6)<=.000501);assert.ok(Math.abs(record.enhancedAltitude-original.altitude)<=.10001);assert.ok(Math.abs(record.distance-(original.distance-r.rows[0].distance)*1000)<=.00501);assert.equal(record.positionLat,undefined);}
 }
});
test('pause events and UTC conversion agree with timestamps',()=>{const r=fixture(),m=decode(toFIT(r,{startDate:start}));assert.equal(m.recordMesgs[0].timestamp.toISOString(),'2008-08-28T15:30:52.000Z');assert.equal(m.sessionMesgs[0].totalElapsedTime,11538);assert.equal(m.sessionMesgs[0].totalTimerTime,7892);assert.equal(m.eventMesgs.length,24);assert.equal(+m.recordMesgs[666].timestamp-+m.recordMesgs[665].timestamp,10000);assert.equal(m.eventMesgs[1].eventType,'stopAll');assert.equal(+m.eventMesgs[2].timestamp-+m.eventMesgs[1].timestamp,9000);const no=decode(toFIT(r,{startDate:start,includePauses:false}));assert.equal(no.sessionMesgs[0].totalElapsedTime,7892);assert.equal(no.eventMesgs.length,2);});
test('selected section rebases distance and retains absolute start including prior pauses',()=>{const r=fixture(),m=decode(toFIT(r,{startDate:start,start:1000,end:1099}));assert.equal(m.recordMesgs.length,100);assert.equal(m.recordMesgs[0].distance,0);assert.equal(+m.recordMesgs[0].timestamp-+start,(1000+17)*1000);assert.equal(m.sessionMesgs[0].totalTimerTime,100);assert.equal(m.sessionMesgs[0].totalElapsedTime,100);});
test('single sample and irregular intervals remain consistent',()=>{const r=fixture(),one=decode(toFIT(r,{startDate:start,start:665,end:665}));assert.equal(one.recordMesgs.length,1);assert.equal(one.sessionMesgs[0].totalElapsedTime,1);assert.equal(one.sessionMesgs[0].totalDistance,0);const synthetic={step:2,rows:[{...r.rows[0],time:2,pause:7,power:100},{...r.rows[1],time:5,pause:0,power:200}]};const m=decode(toFIT(synthetic,{startDate:start}));assert.equal(m.sessionMesgs[0].totalTimerTime,5);assert.equal(m.sessionMesgs[0].totalElapsedTime,12);assert.equal(m.sessionMesgs[0].totalWork,700);assert.equal(m.sessionMesgs[0].avgPower,140);});
test('invalid dates, ranges and overflowing measurements fail explicitly',()=>{for(const d of ['2008-02-30T10:00','no date','1980-01-01T00:00'])assert.throws(()=>fitStartTime(d));const r=fixture();assert.throws(()=>toFIT(r,{}));assert.throws(()=>toFIT(r,{startDate:start,start:4,end:3}));r.rows[0].heartRate=255;assert.throws(()=>toFIT(r,{startDate:start}));});
test('official decoder rejects tampered CRC',()=>{const bytes=toFIT(fixture(),{startDate:start,start:0,end:10});bytes[bytes.length-1]^=1;assert.equal(new Decoder(Stream.fromByteArray(bytes)).checkIntegrity(),false);});

test('computer time zone resolves summer, winter, date changes and DST gaps',()=>{
 assert.equal(fitStartTime('2008-08-28T17:30:52').toISOString(),'2008-08-28T15:30:52.000Z');
 assert.equal(fitStartTime('2008-01-28T17:30:52').toISOString(),'2008-01-28T16:30:52.000Z');
 assert.throws(()=>fitStartTime('2026-03-29T02:30:00'),/does not exist/);
 const old=process.env.TZ;try{process.env.TZ='America/New_York';assert.equal(fitStartTime('2008-08-28T17:30:52').toISOString(),'2008-08-28T21:30:52.000Z');}finally{process.env.TZ=old;}
});
