import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { token } = await req.json()
    if (!token) throw new Error('Токен не предоставлен')

    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    // Проверяем токен
    const { data: link, error } = await adminSupabase
      .from('protected_links')
      .select('original_url, mod_id')
      .eq('protected_token', token)
      .single()

    if (error || !link) {
      throw new Error('Неверная ссылка')
    }

    // Увеличиваем счётчик скачиваний
    await adminSupabase
      .from('protected_links')
      .update({ download_count: (link.download_count || 0) + 1 })
      .eq('id', link.id)

    // Перенаправляем на оригинальную ссылку
    return new Response(null, {
      status: 302,
      headers: { 'Location': link.original_url }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    })
  }
})
