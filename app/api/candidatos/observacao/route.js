import {checkOrigin,requireAdmin,requireCandidate,failure} from '@/lib/security';
import {validId} from '@/lib/vagas.mjs';
import {supabaseAdmin} from '@/lib/supabase';
import {NextResponse} from 'next/server';
export async function POST(req){
  try{
    const origem=checkOrigin(req);if(origem)return origem;
    const admin=requireAdmin(req);if(admin)return admin;
    let body;try{body=await req.json();}catch{return failure('Dados inválidos.',400);}
    if(!body||Array.isArray(body)||Object.keys(body).some(k=>!['candidato_id','observacao'].includes(k))||!validId(body.candidato_id)||typeof body.observacao!=='string'||body.observacao.length>3000)return failure('Observação inválida. Use até 3000 caracteres.',400);
    const negado=await requireCandidate(req,body.candidato_id);if(negado)return negado;
    const {error}=await supabaseAdmin.from('logs_processamento').insert({empresa_id:process.env.NEXT_PUBLIC_EMPRESA_ID,candidato_id:body.candidato_id,etapa:'observacao_recrutador',status:'sucesso',mensagem:'Observação interna salva pelo recrutador.',detalhes:{observacao:body.observacao,responsavel:'admin'}});
    if(error)throw error;
    return NextResponse.json({observacao:body.observacao},{headers:{'Cache-Control':'private, no-store'}});
  }catch{return failure('Não foi possível confirmar o salvamento. Confira a observação ao atualizar antes de tentar novamente.',500);}
}
