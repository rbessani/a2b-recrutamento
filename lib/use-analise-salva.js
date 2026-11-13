"use client";
import {useEffect,useState} from 'react';
// Somente leitura. Abrir uma aba nunca inicia chamada à OpenAI.
export default function useAnaliseSalva(candidatoId,tipo,setAnalise){
 const [carregando,setCarregando]=useState(true),[falha,setFalha]=useState(false),[tentativa,setTentativa]=useState(0);
 useEffect(()=>{const controller=new AbortController();let ativo=true;setCarregando(true);setFalha(false);
 fetch('/api/candidatos/analises?candidato_id='+encodeURIComponent(candidatoId)+'&tipo='+tipo,{cache:'no-store',signal:controller.signal}).then(async r=>{if(!r.ok)throw new Error();return r.json();}).then(j=>{if(ativo)setAnalise(j.analise||null);}).catch(e=>{if(ativo&&e.name!=='AbortError')setFalha(true);}).finally(()=>{if(ativo)setCarregando(false);});
 return()=>{ativo=false;controller.abort();};},[candidatoId,tipo,setAnalise,tentativa]);
 return {carregando,falha,repetir:()=>setTentativa(v=>v+1)};
}
