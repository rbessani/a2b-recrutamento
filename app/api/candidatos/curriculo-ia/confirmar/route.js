import {NextResponse} from 'next/server';
import {checkOrigin,requireAdmin,requireCandidate,failure} from '@/lib/security';
import {supabaseAdmin} from '@/lib/supabase';
import {validId} from '@/lib/vagas.mjs';
export async function POST(req){
 try{
  const denied=checkOrigin(req)||requireAdmin(req);if(denied)return denied;
  let b;try{b=await req.json();}catch{return failure('Dados inválidos.',400);}
  if(!b||Object.keys(b).some(k=>!['candidato_id','analise_id','observacao_base','confirmado','nota_revisada'].includes(k))||!validId(b.candidato_id)||!validId(b.analise_id)||b.confirmado!==true||typeof b.observacao_base!=='string'||b.observacao_base.length>10000)return failure('Confira a análise antes de confirmar.',400);
  const negado=await requireCandidate(req,b.candidato_id);if(negado)return negado;
  if(b.nota_revisada!==undefined&&(!Number.isInteger(b.nota_revisada)||b.nota_revisada<0||b.nota_revisada>100))return failure('Nota inválida. Use 0 a 100.',400);
  const {data,error}=await supabaseAdmin.rpc(b.nota_revisada===undefined?'bsn_confirmar_analise_curriculo':'bsn_revisar_curriculo',{p_empresa:process.env.NEXT_PUBLIC_EMPRESA_ID,p_candidato:b.candidato_id,p_analise:b.analise_id,p_observacao_base:b.observacao_base,...(b.nota_revisada===undefined?{}:{p_nota:b.nota_revisada})});
  if(error)return failure('Não foi possível confirmar. Atualize a lista para conferir antes de tentar novamente.',500);
  if(data.erro)return failure(data.erro,data.status||409);
  return NextResponse.json(data,{headers:{'Cache-Control':'private, no-store'}});
 }catch{return failure('Não foi possível confirmar. Atualize a lista para conferir antes de tentar novamente.',500);}
}
