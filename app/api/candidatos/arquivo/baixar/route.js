import {NextResponse} from 'next/server';
import {supabaseAdmin} from '@/lib/supabase';
import {requireAdmin,requireCandidate,failure} from '@/lib/security';
import {validId} from '@/lib/vagas.mjs';
export const dynamic='force-dynamic';
export async function GET(req){
 try{
  const denied=requireAdmin(req);if(denied)return denied;
  const id=new URL(req.url).searchParams.get('id');
  if(!validId(id))return failure('Arquivo inválido.',400);
  const empresa=process.env.NEXT_PUBLIC_EMPRESA_ID;
  const {data:arquivo,error}=await supabaseAdmin.from('arquivos_candidatos').select('id,candidato_id,tipo,bucket,caminho_storage,nome_arquivo,ativo').eq('id',id).eq('empresa_id',empresa).eq('ativo',true).maybeSingle();
  if(error)throw error;
  if(!arquivo)return failure('Arquivo não encontrado.',404);
  const negado=await requireCandidate(req,arquivo.candidato_id);if(negado)return negado;
  const bucket=arquivo.tipo==='audio'?'audios':arquivo.tipo==='curriculo'?'curriculos':null;
  if(!bucket||arquivo.bucket!==bucket||!arquivo.caminho_storage)return failure('Arquivo indisponível para download.',409);
  const nome=String(arquivo.nome_arquivo||arquivo.caminho_storage.split('/').pop()||'arquivo').replace(/[\x00-\x1f\x7f/\\]/g,'_').slice(0,240);
  const {data:link,error:le}=await supabaseAdmin.storage.from(bucket).createSignedUrl(arquivo.caminho_storage,120,{download:nome});
  if(le||!link?.signedUrl)throw le||new Error();
  // Redirect interno autenticado: link novo por clique, sem trafegar o áudio pela Vercel.
  const response=NextResponse.redirect(link.signedUrl,303);
  response.headers.set('Cache-Control','private, no-store');
  response.headers.set('Referrer-Policy','no-referrer');
  return response;
 }catch{return failure('Não foi possível iniciar o download. Atualize a lista e tente novamente.',502);}
}
