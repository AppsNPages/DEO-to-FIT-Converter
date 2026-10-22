export function syntheticDEO(){
 const count=6,b=new ArrayBuffer(4+count*40+430),v=new DataView(b);v.setUint32(0,count,true);v.setUint32(4,32,true);
 for(let i=0;i<count-1;i++){const o=44+i*40;v.setInt32(o,1+i*2,true);[i*.01,i?200:0,80,200,18,21,130].forEach((x,j)=>v.setFloat32(o+4+j*4,x,true));v.setInt32(o+32,i===1?10:0,true);v.setInt8(o+36,i>=2?1:0);}
 v.setFloat32(4+count*40,5555,true);return b;
}
