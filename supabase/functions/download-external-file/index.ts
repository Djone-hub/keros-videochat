// Файл: supabase/functions/download-external-file/index.ts
// Эта функция проверяет токен доступа и проксирует скачивание с внешних источников

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Обработка CORS preflight-запроса
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Получаем токен из query параметров
    const url = new URL(req.url)
    const token = url.searchParams.get('token')

    if (!token) {
      throw new Error('Токен доступа не предоставлен')
    }

    console.log('🔐 [EXTERNAL DOWNLOAD] Проверка токена:', token.substring(0, 20) + '...')

    // 2. Создаем Admin клиент для проверки токена
    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    )

    // 3. Проверяем токен в базе данных
    const { data: tokenData, error: tokenError } = await adminSupabase
      .from('download_tokens')
      .select('user_id, mod_id, external_url, expires_at')
      .eq('token', token)
      .single()

    if (tokenError || !tokenData) {
      console.error('❌ [EXTERNAL DOWNLOAD] Токен не найден:', tokenError)
      throw new Error('Неверный или истекший токен доступа')
    }

    // 4. Проверяем не истек ли токен
    const expiresAt = new Date(tokenData.expires_at)
    const now = new Date()

    if (expiresAt < now) {
      console.error('❌ [EXTERNAL DOWNLOAD] Токен истек:', expiresAt)
      throw new Error('Срок действия токена истек. Запросите новую ссылку.')
    }

    console.log('✅ [EXTERNAL DOWNLOAD] Токен действителен для пользователя:', tokenData.user_id)

    // 5. Проверяем VIP статус пользователя
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('is_vip, role, vip_expires_at, is_banned')
      .eq('id', tokenData.user_id)
      .single()

    if (!profile || profile.is_banned) {
      throw new Error('Пользователь заблокирован')
    }

    const vipRoles = ['vip', 'moderator', 'moderator_senior', 'admin', 'admin_senior', 'owner']
    const hasRoleAccess = vipRoles.includes(profile.role)
    const hasVipFlag = profile.is_vip === true
    const isNotExpired = !profile.vip_expires_at || new Date(profile.vip_expires_at) > now
    const hasVipAccess = (hasRoleAccess || hasVipFlag) && isNotExpired

    if (!hasVipAccess) {
      throw new Error('Доступ запрещен. Требуется VIP статус.')
    }

    // 6. Получаем информацию о моде для логирования
    const { data: mod } = await adminSupabase
      .from('mods')
      .select('name, download_count')
      .eq('id', tokenData.mod_id)
      .single()

    console.log('📦 [EXTERNAL DOWNLOAD] Скачивание мода:', mod?.name)

    // 7. Перенаправляем пользователя на внешнюю ссылку
    // Важно: Мы не проксируем файл через себя, а перенаправляем с проверенным токеном
    // Это экономит трафик и ускоряет скачивание
    
    // Обновляем счетчик скачиваний
    await adminSupabase
      .from('mods')
      .update({
        download_count: (tokenData.download_count || 0) + 1,
        last_downloaded: new Date().toISOString()
      })
      .eq('id', tokenData.mod_id)

    // Логируем скачивание
    await adminSupabase
      .from('download_logs')
      .insert({
        mod_id: tokenData.mod_id,
        user_id: tokenData.user_id,
        mod_name: mod?.name || 'Неизвестный мод',
        is_vip_mod: true,
        download_url: tokenData.external_url.substring(0, 200),
        created_at: new Date().toISOString()
      })

    // Удаляем использованный токен чтобы нельзя было использовать повторно
    await adminSupabase
      .from('download_tokens')
      .delete()
      .eq('token', token)

    console.log('✅ [EXTERNAL DOWNLOAD] Перенаправление на внешнюю ссылку')

    // Перенаправляем на внешнюю ссылку
    return new Response(null, {
      status: 302,
      headers: {
        'Location': tokenData.external_url,
      },
    })

  } catch (error) {
    console.error('❌ [EXTERNAL DOWNLOAD] Ошибка:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
