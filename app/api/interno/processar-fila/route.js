import {NextResponse} from 'next/server';
import {equalSecret} from '@/lib/session.mjs';
import {supabaseAdmin} from '@/lib/supabase';
import {executarAnaliseAudio} from '@/lib/executar-audio-ia';
import {executarAnaliseCurriculo} from '@/lib/executar-curriculo-ia';
export const runtime='nodejs';
export const maxDuration=60;
export const dynamic='force-dynamic';
export async function POST(req){
 const headers={'Cache-Control':'private, no-store'};
 const token=process.env.CANDIDATURA_WORKER_SECRET;
 if(!token||token.length<32||!equalSecret(req.headers.get('authorization'),'Bearer '+token))return NextResponse.json({error:'Não autorizado.'},{status:401,headers});
 if(process.env.CANDIDATURA_AUTOMATICA_ENABLED!=='true')return NextResponse.json({pausada:true},{headers});
 const empresa=process.env.NEXT_PUBLIC_EMPRESA_ID;
 try{
  const {error:ee}=await supabaseAdmin.rpc('bsn_encerrar_incompletas',{p_empresa:empresa});if(ee)throw ee;
  // Não consumir a fila enquanto qualquer modelo estiver desabilitado.
  if(!process.env.OPENAI_API_KEY||process.env.OPENAI_AUDIO_ENABLED!=='true'||process.env.OPENAI_CURRICULO_ENABLED!=='true')return NextResponse.json({error:'Configure os dois modelos antes de ativar a fila.'},{status:503,headers});
  const {data:tarefa,error}=await supabaseAdmin.rpc('bsn_reservar_analise',{p_empresa:empresa});if(error)throw error;
  if(!tarefa)return NextResponse.json({vazia:true},{headers});
  const executar=tarefa.tipo==='audio'?executarAnaliseAudio:executarAnaliseCurriculo;
  const resposta=await executar(tarefa.candidato_id,tarefa.arquivo_id);
  const dados=await resposta.json();
  const pronta=resposta.ok&&['pronta','aplicada'].includes(dados.analise?.status);
  const {error:saveError}=await supabaseAdmin.from('fila_analises').update({status:pronta?'concluida':'erro',finalizada_em:new Date().toISOString(),analise_id:dados.analise?.id||null,mensagem:pronta?'Sugestão pronta para revisão humana.':'A análise automática não concluiu. Consulte a aba da análise ou avalie manualmente.'}).eq('id',tarefa.id).eq('empresa_id',empresa).eq('status','processando');
  if(saveError)throw saveError;
  return NextResponse.json({processada:true,pronta},{headers});
 }catch{return NextResponse.json({error:'Falha no processamento. Os arquivos enviados permanecem salvos.'},{status:503,headers});}
}
