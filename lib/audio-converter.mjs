import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {execFile} from 'node:child_process';import {promisify} from 'node:util';import ffmpeg from 'ffmpeg-static';
const run=promisify(execFile);
// Arquivo local aleatório, sem URLs, sem shell, sem alterar o original no Storage.
export async function converterAudio(bytes,binario=ffmpeg){
 if(!bytes.byteLength||bytes.byteLength>4000000)throw new Error('Áudio vazio ou maior que 4 MB.');
 const dir=await mkdtemp(join(tmpdir(),'bsn-audio-'));
 try{
  const input=join(dir,'entrada'),output=join(dir,'audio.wav');await writeFile(input,Buffer.from(bytes),{mode:0o600});
  await run(binario,['-nostdin','-hide_banner','-loglevel','error','-protocol_whitelist','file,pipe','-format_whitelist','wav,mp3,mov,ogg,matroska,webm,aac,flac','-i',input,'-map','0:a:0','-vn','-ac','1','-ar','16000','-c:a','pcm_s16le','-t','601','-y',output],{timeout:12000,maxBuffer:65536});
  const wav=await readFile(output); // 601 segundos, no máximo ~19,3 MB.
  if(wav.length>19200100)throw new Error('Duração superior a 10 minutos. Avalie manualmente.');
  if(wav.length<100||wav.toString('ascii',0,4)!=='RIFF')throw new Error('Áudio inválido.');
  // Localizar chunk data: FFmpeg inclui metadados antes do PCM.
  let p=12,size=0;while(p+8<=wav.length){const n=wav.readUInt32LE(p+4);if(wav.toString('ascii',p,p+4)==='data'){size=n;break;}p+=8+n+(n%2);}
  const duracao=size/32000;if(!duracao||duracao>600)throw new Error('Áudio vazio ou superior a 10 minutos. Avalie manualmente.');
  return {bytes:wav,duracao};
 }catch(e){if(e.message?.includes('10 minutos')||e.message==='Áudio inválido.')throw e;throw new Error('Não foi possível preparar o áudio. Use a avaliação manual.');}
 finally{await rm(dir,{recursive:true,force:true});}
}
