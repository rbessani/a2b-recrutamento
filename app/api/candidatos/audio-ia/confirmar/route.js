import {NextResponse} from 'next/server';
import {checkOrigin,requireAdmin,requireCandidate,failure} from '@/lib/security';
import {supabaseAdmin} from '@/lib/supabase';
import {validId} from '@/lib/vagas.mjs';
import {notaAudio} from '@/lib/audio-criterios.mjs';
export async function POST(req){
 try{
  const denied=checkOrigin(req)||requireAdmin(req);if(denied)return denied;
  let b;try{b=await req.json();}catch{return failure('Dados inválidos.',400);}
  if(!b||Object.keys(b).some(k=>!['candidato_id','analise_id','observacao_base','confirmado','criterios'].includes(k))||!validId(b.candidato_id)||!validId(b.analise_id)||b.confirmado!==true||typeof b.observacao_base!=='string'||b.observacao_base.length>3000)return failure('Confira a análise antes de confirmar.',400);
  try{notaAudio(b.criterios);}catch{return failure('Confira os dez critérios de áudio.',400);}
  const negado=await requireCandidate(req,b.candidato_id);if(negado)return negado;
  const {data,error}=await supabaseAdmin.rpc('bsn_confirmar_analise_audio',{p_empresa:process.env.NEXT_PUBLIC_EMPRESA_ID,p_candidato:b.candidato_id,p_analise:b.analise_id,p_observacao_base:b.observacao_base,p_criterios:b.criterios});
  if(error)return failure('Não foi possível confirmar. Atualize a lista para conferir antes de tentar novamente.',500);
  if(data.erro)return failure(data.erro,data.status||409);
  return NextResponse.json(data,{headers:{'Cache-Control':'private, no-store'}});
 }catch{return failure('Não foi possível confirmar. Atualize a lista para conferir antes de tentar novamente.',500);}
}
