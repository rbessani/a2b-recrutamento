import {NextResponse} from 'next/server';
import {requireAdmin,requireCandidate,failure} from '@/lib/security';
import {supabaseAdmin} from '@/lib/supabase';
import {validId} from '@/lib/vagas.mjs';
export const dynamic='force-dynamic';
export async function GET(req){
 try{
  const denied=requireAdmin(req);if(denied)return denied;
  const params=new URL(req.url).searchParams,id=params.get('candidato_id'),tipo=params.get('tipo');
  if(!validId(id)||!['curriculo','audio'].includes(tipo))return failure('Consulta inválida.',400);
  const negado=await requireCandidate(req,id);if(negado)return negado;
  const empresa=process.env.NEXT_PUBLIC_EMPRESA_ID;
  const {data:arquivo,error:ae}=await supabaseAdmin.from('arquivos_candidatos').select('id').eq('candidato_id',id).eq('empresa_id',empresa).eq('tipo',tipo).eq('ativo',true).maybeSingle();if(ae)throw ae;
  let analise=null;
  if(arquivo){const {data,error}=await supabaseAdmin.from(tipo==='audio'?'analises_audio':'analises_curriculo').select('id,status,resultado,observacao,modelo,created_at,aplicada_em,vaga_snapshot').eq('candidato_id',id).eq('empresa_id',empresa).eq('arquivo_id',arquivo.id).in('status',['pronta','aplicada']).order('created_at',{ascending:false}).limit(1).maybeSingle();if(error)throw error;analise=data;}
  return NextResponse.json({analise},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return failure('Não foi possível carregar a avaliação salva. Tente novamente.',500);}
}
