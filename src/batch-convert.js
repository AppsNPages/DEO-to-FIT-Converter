#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {Decoder,Stream} from '@garmin/fitsdk';
import {parseDEO} from '../web/deo.js';
import {toFIT,fitStartTime} from './fit-export.js';

const usage=`DEO → FIT Stapelkonvertierung (Node.js 18 oder neuer)

Aufruf:
  node convert-deo-to-fit.mjs EINGABEORDNER AUSGABEORDNER

- Liest .DEO-Dateien rekursiv, ohne symbolischen Links zu folgen.
- Behält die Unterordnerstruktur im Ausgabeordner bei.
- Verwendet Datum/Uhrzeit aus YYYYMMDD_HHMMSS_NAME.DEO und die Rechnerzeitzone.
- Exportiert ganze Fahrten einschließlich interner Pausen.
- Überschreibt keine vorhandenen FIT-Dateien; erneute Läufe überspringen diese.
- Prüft FIT-Prüfsummen und schreibt pro Lauf einen JSON-Bericht.
- Exit-Code: 0 = erfolgreich/übersprungen, 1 = Dateifehler, 2 = Aufruffehler.

Es werden keine Dateien hochgeladen. DEO-Quelldateien bleiben unverändert.`;
const args=process.argv.slice(2);
if(args.length===0||args.includes('--help')||args.includes('-h')){console.log(usage);process.exit(0);}
if(args.length!==2){console.error(usage);process.exit(2);}

async function main(){
 const input=await fs.realpath(path.resolve(args[0]));
 if(!(await fs.stat(input)).isDirectory())throw new Error('Eingabe ist kein Ordner.');
 await fs.mkdir(path.resolve(args[1]),{recursive:true});
 const output=await fs.realpath(path.resolve(args[1]));
 if(input===output)throw new Error('Bitte einen separaten Ausgabeordner verwenden.');
 const zone=Intl.DateTimeFormat().resolvedOptions().timeZone;
 console.log(`Zeitzone: ${zone}\nEingabe: ${input}\nAusgabe: ${output}`);
 const results=[];let found=0;
 async function* scan(dir){
  let entries;
  try{entries=await fs.readdir(dir,{withFileTypes:true});}
  catch(e){results.push({source:dir,status:'error',error:e.message});console.error(`FEHLER ${dir}: ${e.message}`);return;}
  entries.sort((a,b)=>a.name.localeCompare(b.name));
  for(const entry of entries){const p=path.join(dir,entry.name);if(p===output)continue;if(entry.isDirectory())yield* scan(p);else if(entry.isFile()&&/\.deo$/i.test(entry.name))yield p;}
 }
 for await(const source of scan(input)){
  found++;const relative=path.relative(input,source),destination=path.join(output,relative.replace(/\.deo$/i,'.fit'));
  let temporary;
  try{
   try{await fs.lstat(destination);results.push({source,destination,status:'skipped',reason:'Zieldatei existiert'});console.log(`ÜBERSPRUNGEN ${relative}`);continue;}catch(e){if(e.code!=='ENOENT')throw e;}
   const size=(await fs.stat(source)).size;if(size>40_000_000)throw new Error('Datei überschreitet 40 MB.');
   const bytes=await fs.readFile(source),ride=parseDEO(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),path.basename(source));
   if(!/^\d{4}-\d{2}-\d{2} /.test(ride.date))throw new Error('Datum fehlt im Dateinamen. Erwartet: YYYYMMDD_HHMMSS_NAME.DEO.');
   const startDate=fitStartTime(ride.date.replace(' ','T'));
   const fit=toFIT(ride,{startDate,includePauses:true});
   if(!new Decoder(Stream.fromByteArray(fit)).checkIntegrity())throw new Error('FIT-Prüfsummenprüfung fehlgeschlagen.');
   await fs.mkdir(path.dirname(destination),{recursive:true});
   // Publish complete files atomically, without replacing an existing destination.
   temporary=path.join(path.dirname(destination),`.deo-fit-${randomUUID()}.tmp`);
   await fs.writeFile(temporary,fit,{flag:'wx'});
   await fs.link(temporary,destination);
   await fs.unlink(temporary);temporary=undefined;
   results.push({source,destination,status:'converted',samples:ride.rows.length,bytes:fit.byteLength,startUTC:startDate.toISOString(),warnings:ride.warnings});
   console.log(`OK ${relative} (${ride.rows.length} Messpunkte)`);
  }catch(e){
   if(temporary)await fs.unlink(temporary).catch(()=>{});
   if(e.code==='EEXIST'){results.push({source,destination,status:'skipped',reason:'Zieldatei wurde zwischenzeitlich angelegt'});console.log(`ÜBERSPRUNGEN ${relative}`);}
   else{results.push({source,destination,status:'error',error:e.message});console.error(`FEHLER ${relative}: ${e.message}`);}
  }
 }
 const summary={found,converted:results.filter(r=>r.status==='converted').length,skipped:results.filter(r=>r.status==='skipped').length,errors:results.filter(r=>r.status==='error').length};
 const report=path.join(output,`conversion-report-${new Date().toISOString().replace(/[:.]/g,'-')}-${randomUUID().slice(0,8)}.json`);
 await fs.writeFile(report,JSON.stringify({createdAt:new Date().toISOString(),timeZone:zone,input,output,summary,results},null,2),{flag:'wx'});
 console.log(`\nFertig: ${summary.converted} konvertiert, ${summary.skipped} übersprungen, ${summary.errors} Fehler.\nBericht: ${report}`);
 if(found===0)console.log('Keine DEO-Dateien gefunden.');
 process.exitCode=summary.errors?1:0;
}
main().catch(e=>{console.error(`Abbruch: ${e.message}`);process.exitCode=2;});
