import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Cliente público — frontend
export const supabase = createClient(supabaseUrl, supabasePublishableKey)

// Cliente admin — rotas de API (nunca expor no frontend)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
