import fs from 'node:fs/promises';
import {constants} from 'node:fs';

// Hardlinks publish atomically. Some external filesystems and SMB shares do not
// support them; exclusive copy preserves the no-overwrite guarantee there.
export async function publishFile(source,destination,io=fs){
 try{await io.link(source,destination);}
 catch(error){
  if(!['ENOTSUP','EOPNOTSUPP','ENOSYS','EXDEV','EPERM'].includes(error.code))throw error;
  await io.copyFile(source,destination,constants.COPYFILE_EXCL);
 }
}
