import {checkOrigin,requireAdmin,requireCandidate,failure} from '@/lib/security';
import {validId} from '@/lib/vagas.mjs';
import {supabaseAdmin} from '@/lib/supabase';
import {NextResponse} from 'next/server';
export async function POST(req){
  try{
    const origem=checkOrigin(req);if(origem)return origem;
    const admin=requireAdmin(req);if(admin)return admin;
    let body;try{body=await req.json();}catch{return failure('Dados inválidos.',400);}
    if(!body||Array.isArray(body)||Object.keys(body).some(k=>!['candidato_id','observacao','observacao_base'].includes(k))||!validId(body.candidato_id)||typeof body.observacao!=='string'||body.observacao.length>3000||(body.observacao_base!==undefined&&(typeof body.observacao_base!=='string'||body.observacao_base.length>3000)))return failure('Observação inválida. Use até 3000 caracteres.',400);
    const negado=await requireCandidate(req,body.candidato_id);if(negado)return negado;
    const {data,error}=await supabaseAdmin.rpc('bsn_salvar_observacao_recrutador',{p_empresa:process.env.NEXT_PUBLIC_EMPRESA_ID,p_candidato:body.candidato_id,p_texto:body.observacao,p_base:body.observacao_base??null});
    if(error)throw error;
    if(data.erro)return failure(data.erro,data.status||409);
    return NextResponse.json({observacao:body.observacao},{headers:{'Cache-Control':'private, no-store'}});
  }catch{return failure('Não foi possível confirmar o salvamento. Confira a observação ao atualizar antes de tentar novamente.',500);}
}
