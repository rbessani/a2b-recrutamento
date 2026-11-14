import {checkOrigin,requireAdmin,requireCandidate,failure} from '@/lib/security';
import {validId} from '@/lib/vagas.mjs';
import {executarAnaliseCurriculo} from '@/lib/executar-curriculo-ia';
export const runtime='nodejs';
export const maxDuration=60;
export const dynamic='force-dynamic';
export async function POST(req){
 try{
 const denied=checkOrigin(req)||requireAdmin(req);if(denied)return denied;
 let body;try{body=await req.json();}catch{return failure('Dados inválidos.',400);}
 if(!body||Object.keys(body).some(k=>k!=='candidato_id')||!validId(body.candidato_id))return failure('Inscrição inválida.',400);
 const negado=await requireCandidate(req,body.candidato_id);if(negado)return negado;
 return await executarAnaliseCurriculo(body.candidato_id);
 }catch{return failure('Não foi possível analisar. Nenhuma nota foi alterada.',502);}
}
