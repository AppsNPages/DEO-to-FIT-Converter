import {Encoder, Profile} from '@garmin/fitsdk';
const FIT_EPOCH_MS=631065600000;
const MAX_TIME=0xfffffffe;
export function fitStartTime(localTime){
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(localTime)) throw new Error('Enter a valid local start date and time.');
  const full=localTime.length===16?localTime+':00':localTime;
  const parts=full.match(/\d+/g).map(Number);
  const date=new Date(full);
  const actual=[date.getFullYear(),date.getMonth()+1,date.getDate(),date.getHours(),date.getMinutes(),date.getSeconds()];
  if(!Number.isFinite(date.getTime())||parts.some((x,i)=>x!==actual[i]))throw new Error('Invalid local date/time, or this time does not exist due to a daylight-saving change.');
  const sec=(date.getTime()-FIT_EPOCH_MS)/1000;
  if(!Number.isInteger(sec)||sec<0x10000000||sec>MAX_TIME)throw new Error('Start date is outside the supported FIT date range (1998–2126).');
  return date;
}

function fitBound(value,min,max,name){if(!Number.isFinite(value)||value<min||value>max)throw new Error(`${name} is outside the FIT range; export cancelled instead of truncating data.`);return value;}
/** Start date anchors the first DEO sample. Pause on sample i shifts subsequent samples,
 * matching native alternate exporter 0x405131–0x40515f. Selection excludes final trailing pause. */
export function toFIT(ride,{start=0,end=ride.rows.length-1,startDate,includePauses=true}={}){
  const all=ride.rows;
  if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<start||end>=all.length)throw new Error('Invalid export selection.');
  if(!(startDate instanceof Date)||!Number.isFinite(startDate.getTime()))throw new Error('A start date is required.');
  const epoch=(startDate.getTime()-FIT_EPOCH_MS)/1000;
  fitBound(epoch,0x10000000,MAX_TIME,'Start date');
  if(!Number.isInteger(epoch))throw new Error('Start time must use whole seconds.');
  fitBound(ride.step,1,86400,'Recording interval');
  for(let i=0;i<=end;i++){if(!Number.isInteger(all[i].time)||all[i].time<0||(i&&all[i].time<=all[i-1].time))throw new Error('Invalid recorded timestamps.');if(!Number.isInteger(all[i].pause)||all[i].pause<0)throw new Error('Invalid pause duration.');}
  const rows=all.slice(start,end+1), prior=includePauses?all.slice(0,start).reduce((s,r)=>s+r.pause,0):0;
  const startSec=epoch+all[start].time-all[0].time+prior;
  const timer=rows.at(-1).time-rows[0].time+ride.step;
  const pauses=includePauses?rows.slice(0,-1).reduce((s,r)=>s+r.pause,0):0;
  const elapsed=timer+pauses,finishSec=startSec+elapsed;
  fitBound(finishSec,0x10000000,MAX_TIME,'End date');fitBound(elapsed,0,4294967.294,'Elapsed time');
  const date=sec=>new Date(FIT_EPOCH_MS+sec*1000);
  const distance=(rows.at(-1).distance-rows[0].distance)*1000;
  fitBound(distance,0,42949672.94,'Total distance');
  const encoder=new Encoder(),write=(id,msg)=>encoder.onMesg(id,msg),M=Profile.MesgNum;
  write(M.FILE_ID,{type:'activity',manufacturer:'development',product:1,productName:'DEO Lab',timeCreated:date(startSec)});
  write(M.DEVICE_INFO,{timestamp:date(startSec),deviceIndex:0,manufacturer:'development',product:1,productName:'DEO Lab',softwareVersion:1});
  const event=(sec,type)=>write(M.EVENT,{timestamp:date(sec),event:'timer',eventType:type,eventGroup:0});
  event(startSec,'start');
  let pauseSum=0,work=0;const totals={power:0,heartRate:0,cadence:0,speed:0},max={power:0,heartRate:0,cadence:0,speed:0};
  rows.forEach((r,i)=>{
    const sec=startSec+r.time-rows[0].time+pauseSum,dt=i+1<rows.length?rows[i+1].time-r.time:ride.step;
    const metres=fitBound((r.distance-rows[0].distance)*1000,0,42949672.94,'Distance');
    const power=fitBound(Math.round(r.power),0,65534,'Power'),heartRate=fitBound(Math.round(r.heartRate),0,254,'Heart rate'),cadence=fitBound(Math.round(r.cadence),0,254,'Cadence');
    const speed=fitBound(r.speed/3.6,0,4294967.294,'Speed'),altitude=fitBound(r.altitude,-500,858992958.8,'Altitude'),temperature=fitBound(Math.round(r.temperature),-128,126,'Temperature');
    const record={timestamp:date(sec),distance:metres,power,heartRate,cadence,enhancedSpeed:speed,enhancedAltitude:altitude,temperature};
    if(Math.round(speed*1000)<=65534)record.speed=speed;
    if(Math.round((altitude+500)*5)<=65534)record.altitude=altitude;
    write(M.RECORD,record);
    for(const [key,val] of Object.entries({power,heartRate,cadence,speed})){totals[key]+=val*dt;max[key]=Math.max(max[key],val);}work+=power*dt;
    if(includePauses&&i+1<rows.length&&r.pause>0){event(sec+dt,'stopAll');pauseSum+=r.pause;event(sec+dt+r.pause,'start');}
  });
  event(finishSec,'stopAll');
  fitBound(work,0,4294967294,'Total work');
  const summary={timestamp:date(finishSec),startTime:date(startSec),totalElapsedTime:elapsed,totalTimerTime:timer,totalDistance:distance,avgPower:Math.round(totals.power/timer),maxPower:max.power,avgHeartRate:Math.round(totals.heartRate/timer),maxHeartRate:max.heartRate,avgCadence:Math.round(totals.cadence/timer),maxCadence:max.cadence,totalWork:Math.round(work)};
  const avgSpeed=distance/timer;
  if(Math.round(avgSpeed*1000)<=65534)summary.avgSpeed=avgSpeed;
  if(Math.round(max.speed*1000)<=65534)summary.maxSpeed=max.speed;
  write(M.LAP,{...summary,messageIndex:0,event:'lap',eventType:'stop',lapTrigger:'sessionEnd',sport:'cycling'});
  write(M.SESSION,{...summary,messageIndex:0,event:'session',eventType:'stop',sport:'cycling',subSport:'generic',firstLapIndex:0,numLaps:1,trigger:'activityEnd'});
  write(M.ACTIVITY,{timestamp:date(finishSec),totalTimerTime:timer,numSessions:1,type:'manual',event:'activity',eventType:'stop'});
  return encoder.close();
}
