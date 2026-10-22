import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../web/',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.txt':'text/plain; charset=utf-8','.json':'application/json'};
const port=Number(process.env.PORT||8765);
const server=http.createServer(async(req,res)=>{
 try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root)){res.writeHead(403);res.end();return;}
  const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
 }catch{res.writeHead(404);res.end('Not found');}
});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`Port ${port} ist belegt. Anderen Port wählen: PORT=8766 npm start`:e.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`DEO Lab: http://127.0.0.1:${port}/ (Strg+C beendet den Server)`));
