/** Observed ErgoRacer header values 0 and 32. See evidence.html and workspace evidence. */
export const fields = ['distance','power','cadence','altitude','speed','temperature','heartRate'];
export function parseDEO(buffer, filename='ride.deo') {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 634) throw new Error('File is too short to contain a DEO ride.');
  if (buffer.byteLength > 40_000_000) throw new Error('This reader supports files up to 40 MB.');
  const v=new DataView(buffer), n=v.getUint32(0,true), layout=v.getUint32(4,true);
  if(![0,32].includes(layout)) throw new Error(`Unsupported DEO header value ${layout}. Only the observed values 0 and 32 are supported.`);
  if(n<5 || n>199999 || ![430,450].includes(buffer.byteLength-(44+(n-1)*40))) throw new Error('DEO length does not match its record count. The file is truncated or uses an unsupported variant.');
  const tail=44+(n-1)*40;
  if(![0,5555].includes(v.getFloat32(tail,true))) throw new Error('DEO trailer marker is missing.');
  const rows=[];
  for(let i=0;i<n-1;i++){
    const o=44+i*40, time=v.getInt32(o,true), row={tick:i+1,time};
    if(time<0 || (i && time<=rows[i-1].time)) throw new Error(`Invalid or non-increasing timestamp at record ${i+1}.`);
    row.pause=v.getInt32(o+32,true); row.interval=v.getInt8(o+36); row.reserved=Array.from(new Uint8Array(buffer,o+37,3));
    fields.forEach((f,j)=>{const x=v.getFloat32(o+4+j*4,true); if(!Number.isFinite(x)) throw new Error(`Non-finite ${f} at record ${i+1}.`); row[f]=x;});
    if(row.distance<0 || row.speed<0 || row.power<0 || row.cadence<0 || row.heartRate<0) throw new Error(`Negative measurement at record ${i+1}.`);
    if(i && row.distance+0.001<rows[i-1].distance) throw new Error('Distance decreases; this DEO variant is not supported.');
    rows.push(row);
  }
  const m=filename.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})_(.+)\.deo$/i);
  const warnings=['Core fields are verified against the native CSV exporter. Header/trailer metadata and advanced analysis formulas are not fully decoded.'];
  if(rows.some(r=>r.pause!==0)) warnings.push('Pause values are shown separately; recorded duration and work do not add pause time.');
  if(rows.some(r=>r.reserved.some(x=>x!==0))) warnings.push('Nonzero reserved bytes are preserved in CSV without interpretation.');
  if(v.getFloat32(tail,true)===0) warnings.push('Trailer marker is zero, as in one supplied legacy fixture; trailer metadata is not interpreted.');
  const step=rows[1].time-rows[0].time;
  if(rows.slice(1).some((r,i)=>r.time-rows[i].time!==step)) warnings.push('Irregular timestamps: work uses each sample until the next timestamp, with the final sample using the first recording interval.');
  return {filename,layout,rows,step,header:Array.from({length:11},(_,i)=>v.getUint32(i*4,true)),rider:m?m[7]:'Imported ride',date:m?`${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]}`:'Date not encoded in filename',warnings};
}
export function summarize(rows, interval=1){
  if(!rows.length) return null;
  const metrics={};
  for(const f of ['power','heartRate','cadence','speed','altitude','temperature']){
    let sum=0,min=Infinity,max=-Infinity;for(const r of rows){sum+=r[f];min=Math.min(min,r[f]);max=Math.max(max,r[f]);}
    metrics[f]={mean:sum/rows.length,min,max};
  }
  let nz=0,sum=0;for(const r of rows)if(r.power>0){nz++;sum+=r.power;}
  let work=0; rows.forEach((r,i)=>work+=r.power*(i+1<rows.length?rows[i+1].time-r.time:interval)/1000);
  return {...metrics,powerNonzero:nz?sum/nz:null,seconds:rows.at(-1).time-rows[0].time+interval,distance:rows.at(-1).distance-rows[0].distance,work};
}
export function toCSV(rows,interval=1){
  return ['sample,recorded_time_s,distance_km,power_W,cadence_rpm,altitude_m,speed_kmh,temperature_C,heart_rate_bpm,pause_s,interval,reserved_hex',...rows.map(r=>[r.tick,r.time,...fields.map(f=>r[f]),r.pause,r.interval,r.reserved.map(x=>x.toString(16).padStart(2,'0')).join('')].join(','))].join('\r\n');
}
export function demoRide(){
  // Illustrative fixture; never derived from a user's ride or bundled proprietary data.
  const rows=[]; let km=0;
  for(let i=0;i<3600;i++){const speed=26+6*Math.sin(i/260)+2*Math.sin(i/31),power=i%580<45?0:Math.max(0,170+70*Math.sin(i/260)+30*Math.sin(i/11));km+=speed/3600;rows.push({tick:i+1,time:i+1,distance:km,power,cadence:power?82+9*Math.sin(i/60):0,altitude:180+50*Math.sin(i/500),speed,temperature:21+i/1800,heartRate:125+18*Math.sin(i/260)+8*(1-Math.exp(-i/200)),pause:0,interval:0,reserved:[0,0,0]});}
  return {filename:'Illustrative demo · not an ErgoRacer recording',rider:'Demo ride',date:'Synthetic sample · 60 minutes',layout:32,step:1,rows,warnings:['Synthetic data for trying the interface. Import a DEO file to inspect an actual recording.']};
}
