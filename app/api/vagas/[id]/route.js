import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { checkOrigin,requireAdmin,failure } from '@/lib/security'
import { vacancyPayload,validId } from '@/lib/vagas.mjs'
export async function PATCH(req,{params}){
 try{
  const denied=checkOrigin(req)||requireAdmin(req);if(denied)return denied
  if(!validId(params.id))return failure('Vaga inválida.',400)
  const {data:old,error:readError}=await supabaseAdmin.from('vagas').select('*').eq('id',params.id).eq('empresa_id',process.env.NEXT_PUBLIC_EMPRESA_ID).maybeSingle()
  if(readError)throw readError
  if(!old)return failure('Vaga não encontrada.',404)
  const body=await req.json();let payload
  try{payload=vacancyPayload(body,old)}catch(e){return failure(e.message,409)}
  const {error}=await supabaseAdmin.from('vagas').update(payload).eq('id',old.id).eq('empresa_id',process.env.NEXT_PUBLIC_EMPRESA_ID)
  if(error){if(error.code==='23514')return failure('Os pesos estão bloqueados após a primeira inscrição. Atualize a tela ou duplique a vaga.',409);throw error}
  return NextResponse.json({ok:true})
 }catch{return failure('Não foi possível salvar a vaga.',500)}
}
