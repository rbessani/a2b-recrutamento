"use client";
import {useEffect,useRef} from 'react';
export default function ContextoCandidato({cabecalho,children}){
  const ficha=useRef(null),header=useRef(null);
  useEffect(()=>{
    const atualizar=()=>{if(ficha.current&&header.current)ficha.current.style.setProperty('--altura-contexto',Math.ceil(header.current.getBoundingClientRect().height)+'px');};
    atualizar();const observer=new ResizeObserver(atualizar);observer.observe(header.current);return()=>observer.disconnect();
  },[]);
  return <article ref={ficha} className="ficha-candidato">
    <header ref={header} className="contexto-candidato">{cabecalho}</header>
    {children}
    <style jsx>{`
      .ficha-candidato{position:relative;background:white;border-radius:16px;box-shadow:0 4px 20px rgba(0,62,138,.08);border:1px solid #e2e8f0;padding:16px;margin-bottom:20px;--altura-contexto:180px}
      .contexto-candidato{position:sticky;top:0;z-index:5;background:white;margin:0 0 10px;padding:8px 0 10px;border-bottom:1px solid #e2e8f0;box-shadow:0 5px 6px -7px rgba(0,62,138,.25)}
      @media(max-width:600px){.ficha-candidato{padding:12px}.contexto-candidato{max-height:45vh;overflow-y:auto}}
    `}</style>
  </article>;
}
