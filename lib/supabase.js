import 'server-only'
import { createClient } from '@supabase/supabase-js'

// Consultas do servidor devem refletir o banco atual, inclusive após editar vagas.
// O no-store da resposta HTTP não substitui o controle desta chamada ao Supabase.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
    },
  },
)
