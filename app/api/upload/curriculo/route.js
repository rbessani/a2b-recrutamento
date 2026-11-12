import { enviarPendente } from '@/lib/upload-pendente'
export async function POST(req) { return enviarPendente(req, 'curriculo') }
