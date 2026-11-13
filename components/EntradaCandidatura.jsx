import { useRef, useState } from 'react';
import './EntradaCandidatura.css';

const OPORTUNIDADES = 'https://bessani.com.br/trabalhe-conosco#oportunidades';
function Icone({tipo}) {
  return <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{tipo==='audio'?<><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0014 0v-2M12 19v3M8 22h8"/></>:tipo==='escudo'?<><path d="M12 2l9 4v6c0 5-9 10-9 10S3 17 3 12V6z"/><path d="M8 12l3 3 5-6"/></>:<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/></>}</svg>;
}
export default function EntradaCandidatura({vaga, carregando, erro, codigoErro, onRetry, onAdmin, consentimento, onConsentimento, onNext, retomada}) {
  const [aviso,setAviso]=useState(false);
  const [iniciando,setIniciando]=useState(false);
  const trava=useRef(false);
  const indisponivel=!!erro || !vaga || (vaga.status && vaga.status!=='ativa');
  const iniciar=()=>{
    if(trava.current || indisponivel)return;
    if(!consentimento){setAviso(true);document.getElementById('consentimento-candidatura')?.focus();return;}
    trava.current=true;setIniciando(true);onNext();
  };
  return <div className="candidatura-entrada">
    <header className="entrada-header"><div className="entrada-header-inner"><img src="/bessani-solucoes.svg" alt="Bessani Soluções" width="220" height="68"/><a href={OPORTUNIDADES}>← Voltar às oportunidades</a></div></header>
    <main className="entrada-main" aria-busy={carregando}>
      {carregando ? <section className="entrada-card entrada-estado" role="status"><div className="entrada-carregando"/><h1>Carregando oportunidade…</h1><p>Aguarde um instante.</p></section> : erro ? <section className="entrada-card entrada-estado" role="alert"><h1>{codigoErro===400?'Link de vaga inválido':codigoErro===404?'Vaga indisponível':'Não foi possível carregar a oportunidade'}</h1><p>{erro}</p><div className="entrada-estado-acoes">{codigoErro!==400&&codigoErro!==404&&<button className="entrada-botao" onClick={onRetry}>Tentar novamente</button>}<a href={OPORTUNIDADES}>Ver oportunidades</a></div></section> : vaga && <>
        <nav className="entrada-breadcrumb" aria-label="Caminho de navegação"><a href={OPORTUNIDADES}>Trabalhe conosco</a><span aria-hidden="true">/</span><span>{vaga.titulo}</span></nav>
        <div className="entrada-titulo"><h1>{vaga.titulo}</h1><span className={'entrada-selo'+(indisponivel?' entrada-selo-fechado':'')}>{vaga.status==='encerrada'?'Vaga encerrada':vaga.status==='pausada'?'Vaga pausada':indisponivel?'Vaga indisponível':'Vaga aberta'}</span></div>
        {retomada}
        <div className="entrada-colunas">
          <section className="entrada-card entrada-sobre"><h2>Sobre a oportunidade</h2>{vaga.descricao?.trim()?<p className="entrada-descricao">{vaga.descricao}</p>:<p className="entrada-sem-descricao">Esta vaga ainda não tem uma descrição cadastrada.</p>}</section>
          <aside className="entrada-card entrada-preparo"><h2>Prepare-se para começar</h2><p>Tenha seu currículo em mãos e prepare-se para gravar um breve áudio seguindo a instrução da vaga.</p><div className="entrada-preparo-icones"><span><Icone tipo="curriculo"/>Currículo</span><span><Icone tipo="audio"/>Áudio</span></div><p className="entrada-dica">Você também responderá ao questionário de perfil comportamental.</p><p className="entrada-limite">PDF ou DOCX para o currículo · Até 4 MB por arquivo.</p></aside>
        </div>
        {!indisponivel&&<><section className="entrada-card entrada-privacidade" aria-labelledby="privacidade-titulo"><div className="entrada-escudo"><Icone tipo="escudo"/></div><div className="entrada-privacidade-conteudo"><h2 id="privacidade-titulo">Privacidade e uso dos seus dados</h2><p>Antes de continuar, consulte as informações sobre o tratamento dos seus dados neste processo seletivo.</p><details><summary>Ler aviso de privacidade</summary><div className="entrada-aviso"><h3>Política de Privacidade — LGPD</h3><p>A <strong>Bessani Soluções</strong> coletará seus dados com finalidade exclusiva de avaliação de candidatura.</p><p><strong>Dados coletados:</strong> nome, e-mail, telefone, cidade, estado, respostas comportamentais, áudio e currículo.</p><p><strong>Armazenamento:</strong> Ambiente com acesso restrito às pessoas responsáveis pelo recrutamento.</p><p><strong>Apoio à análise:</strong> O currículo poderá ser processado por um serviço de inteligência artificial da OpenAI para auxiliar a avaliação em relação à vaga. A análise é revisada pelo recrutador; a decisão de seleção é humana. Esse processamento pode envolver transferência internacional de dados.</p><p><strong>Prazo:</strong> Até 24 meses. Eliminação disponível mediante solicitação.</p></div></details><label className="entrada-consentimento" htmlFor="consentimento-candidatura"><input id="consentimento-candidatura" name="lgpd_aceito" type="checkbox" checked={consentimento} onChange={e=>{onConsentimento(e.target.checked);setAviso(false);}} aria-invalid={aviso} aria-describedby={aviso?'consentimento-erro':undefined}/><span><strong>Li e concordo</strong> com os Termos e autorizo o tratamento dos meus dados pela Bessani Soluções, conforme a LGPD.</span></label>{aviso&&<p id="consentimento-erro" className="entrada-erro" role="alert">Aceite os termos para continuar.</p>}</div></section>
        <div className="entrada-comecar"><button className="entrada-botao" disabled={iniciando} onClick={iniciar}>{iniciando?'Aguarde…':'Começar minha candidatura'} <span aria-hidden="true">→</span></button></div></>}
        {indisponivel&&<p role="status">Esta vaga não está recebendo novas inscrições. <a href={OPORTUNIDADES}>Ver oportunidades</a></p>}
        <ol className="entrada-etapas" aria-label="Etapas após o consentimento">{['Dados pessoais','Perfil comportamental','Áudio','Currículo'].map((etapa,i)=><li key={etapa}>{i>0&&<span aria-hidden="true">›</span>}{etapa}</li>)}</ol>
      </>}
    </main>
    <footer className="entrada-footer"><span><strong>Bessani Soluções</strong> · Tecnologia feita por pessoas.</span><button onClick={onAdmin}>Área administrativa</button></footer>
  </div>;
}
