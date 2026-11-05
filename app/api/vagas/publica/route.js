import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { failure } from '@/lib/security'
import { validId } from '@/lib/vagas.mjs'
export const dynamic = 'force-dynamic'
export async function GET(req) {
 try {
  const params = new URL(req.url).searchParams
  const id = params.has('vaga') ? params.get('vaga') : process.env.NEXT_PUBLIC_VAGA_ID
  if (!validId(id)) return failure('Link de vaga inválido.',400)
  const {data,error}=await supabaseAdmin.from('vagas').select('id,titulo,descricao,roteiro_audio').eq('id',id).eq('empresa_id',process.env.NEXT_PUBLIC_EMPRESA_ID).eq('status','ativa').maybeSingle()
  if(error)throw error
  if(!data)return failure('Esta vaga não está disponível para inscrições.',404)
  return NextResponse.json({vaga:data},{headers:{'Cache-Control':'no-store'}})
 } catch {return failure('Não foi possível carregar a vaga. Tente novamente.',500)}
}
