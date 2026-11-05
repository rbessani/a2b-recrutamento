import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { checkOrigin,requireAdmin,failure } from '@/lib/security'
import { vacancyPayload,validId } from '@/lib/vagas.mjs'
export const dynamic='force-dynamic'
export async function GET(req){
 try{
  const denied=requireAdmin(req);if(denied)return denied
  const {data,error}=await supabaseAdmin.from('vagas').select('id,titulo,descricao,status,roteiro_audio,pesos_bloqueados,peso_perfil_a,peso_perfil_b,peso_perfil_c,peso_perfil_d,created_at').eq('empresa_id',process.env.NEXT_PUBLIC_EMPRESA_ID).order('created_at',{ascending:false})
  if(error)throw error
  return NextResponse.json({vagas:data||[]},{headers:{'Cache-Control':'private, no-store'}})
 }catch{return failure('Não foi possível listar as vagas.',500)}
}
export async function POST(req){
 try{
  const denied=checkOrigin(req)||requireAdmin(req);if(denied)return denied
  const body=await req.json();let input=body
  if(body.duplicar_de){
   if(!validId(body.duplicar_de))return failure('Vaga inválida.',400)
   const {data,error}=await supabaseAdmin.from('vagas').select('titulo,descricao,roteiro_audio,peso_perfil_a,peso_perfil_b,peso_perfil_c,peso_perfil_d').eq('id',body.duplicar_de).eq('empresa_id',process.env.NEXT_PUBLIC_EMPRESA_ID).maybeSingle()
   if(error)throw error
   if(!data)return failure('Vaga não encontrada.',404)
   input={...data,titulo:(data.titulo+' — cópia').slice(0,160),descricao:data.descricao||'',status:'inativa'}
  }
  let payload;try{payload=vacancyPayload(input)}catch(e){return failure(e.message,400)}
  const {data,error}=await supabaseAdmin.from('vagas').insert({...payload,empresa_id:process.env.NEXT_PUBLIC_EMPRESA_ID,peso_comportamental:40,peso_curriculo:30,peso_audio:30}).select('id').single()
  if(error)throw error
  return NextResponse.json({vaga:data},{status:201})
 }catch{return failure('Não foi possível criar a vaga.',500)}
}
