// 🛡️ ОБНОВЛЕННАЯ ФУНКЦИЯ ДЛЯ VIP СКАЧИВАНИЯ
// Использует усиленную защиту с IP-привязкой

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Функция для создания Supabase клиента с правами администратора
function createAdminClient() {
  return createClient(
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
}

// Генерация защищенного токена
function generateSecureToken(userId: string, modId: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 15)
  const sessionFingerprint = btoa(`${userId}-${modId}-${timestamp}-${random}`)
  return sessionFingerprint.replace(/[^a-zA-Z0-9]/g, '').substring(0, 32)
}

// Извлечение IP адреса
function getClientIP(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  const realIP = req.headers.get('x-real-ip')
  const cfConnectingIP = req.headers.get('cf-connecting-ip')
  
  if (forwarded) return forwarded.split(',')[0].trim()
  if (realIP) return realIP.trim()
  if (cfConnectingIP) return cfConnectingIP.trim()
  return 'unknown'
}

serve(async (req) => {
  // Обработка CORS preflight-запроса
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Получаем токен пользователя из заголовков
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Отсутствует заголовок авторизации')
    }

    // 2. Создаем Supabase клиент от имени пользователя
    const userSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // 3. Получаем данные пользователя по его токену
    const { data: { user }, error: userError } = await userSupabase.auth.getUser()
    if (userError || !user) {
      throw new Error('Неверный токен пользователя или пользователь не найден')
    }

    // 4. Проверяем VIP-статус и блокировки пользователя в таблице profiles
    const { data: profile, error: profileError } = await userSupabase
      .from('profiles')
      .select('is_vip, role, vip_expires_at, is_banned')
      .eq('id', user.id)
      .single()

    if (profileError) throw profileError

    // Проверяем, не заблокирован ли пользователь
    if (profile.is_banned) {
      return new Response(JSON.stringify({ error: 'Пользователь заблокирован' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    // 🔧 УЛУЧШЕННАЯ ПРОВЕРКА VIP СТАТУСА
    const vipRoles = ['vip', 'moderator', 'moderator_senior', 'admin', 'admin_senior', 'owner']
    const hasRoleAccess = vipRoles.includes(profile.role)
    const hasVipFlag = profile.is_vip === true
    const isNotExpired = !profile.vip_expires_at || new Date(profile.vip_expires_at) > new Date()
    const hasVipAccess = (hasRoleAccess || hasVipFlag) && isNotExpired

    console.log('🔍 [DOWNLOAD] VIP проверка:', {
      hasRoleAccess,
      hasVipFlag,
      isNotExpired,
      hasVipAccess,
      role: profile.role,
      is_vip: profile.is_vip,
      vip_expires_at: profile.vip_expires_at
    })

    if (!hasVipAccess) {
      return new Response(JSON.stringify({ error: 'Доступ запрещен. Требуется VIP-статус.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    // 5. Получаем ID мода из тела запроса
    const { modId } = await req.json()
    if (!modId) {
      throw new Error('ID мода не предоставлен')
    }

    // 6. Используем АДМИН-клиент для получения информации о моде
    const adminSupabase = createAdminClient()
    const { data: mod, error: modError } = await adminSupabase
      .from('mods')
      .select('file_path, is_private, download_url, name, category')
      .eq('id', modId)
      .single()

    if (modError || !mod) {
      throw new Error('Мод не найден в базе данных')
    }

    // Проверяем, является ли мод VIP
    const isVipMod = mod.is_private === true || mod.category === 'vip_mods'

    if (!isVipMod) {
      throw new Error('Этот мод не является VIP и должен скачиваться напрямую.')
    }

    // 7. Генерируем временную подписанную ссылку
    let downloadUrl = null
    let isExternalLink = false

    console.log('🔍 [DOWNLOAD] Информация о моде:', {
      file_path: mod.file_path,
      download_url: mod.download_url,
      name: mod.name
    })

    if (mod.file_path) {
      // 🔐 Для файлов в Supabase Storage - генерируем уникальную подписанную ссылку
      console.log('📦 [DOWNLOAD] Используем file_path:', mod.file_path)
      const { data: signedUrlData, error: signedUrlError } = await userSupabase.storage
        .from('private-mods')
        .createSignedUrl(mod.file_path, 60) // Ссылка действительна 60 секунд

      if (signedUrlError) {
        console.error('❌ [DOWNLOAD] Ошибка создания подписанной ссылки:', signedUrlError)
        throw signedUrlError
      }
      downloadUrl = signedUrlData.signedUrl
      console.log('🔐 [DOWNLOAD] Сгенерирована уникальная ссылка для файла в Storage')
      
    } else if (mod.download_url) {
      // �️ Для внешних ссылок - используем усиленную защиту
      isExternalLink = true
      console.log('🔗 [DOWNLOAD] Используем внешнюю ссылку:', mod.download_url)
      
      // Собираем защитную информацию
      const clientIP = getClientIP(req)
      const userAgent = req.headers.get('user-agent') || 'unknown'
      const referer = req.headers.get('referer')
      const refererDomain = referer ? new URL(referer).hostname : null
      const sessionId = req.headers.get('x-session-id') || 'no-session'
      
      const secureToken = generateSecureToken(user.id, modId)
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 минут
      
      // Сохраняем в усиленную таблицу защиты
      const { error: tokenError } = await adminSupabase
        .from('vip_download_tokens')
        .insert({
          token: secureToken,
          user_id: user.id,
          mod_id: modId,
          external_url: mod.download_url,
          user_ip: clientIP,
          user_agent: userAgent,
          referer_domain: refererDomain,
          session_id: sessionId,
          expires_at: expiresAt.toISOString()
        })

      if (tokenError) {
        console.warn('⚠️ [DOWNLOAD] Не удалось сохранить токен:', tokenError.message)
        downloadUrl = mod.download_url
      } else {
        // Используем новую защищенную функцию
        downloadUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/download-vip-secure?token=${secureToken}`
        console.log('�️ [DOWNLOAD] Сгенерирован защищенный токен с IP-привязкой')
      }
    } else {
      console.error('❌ [DOWNLOAD] Нет файла для скачивания:', { modId, name: mod.name })
      throw new Error('Нет файла для скачивания. Мод загружен некорректно.')
    }

    if (!downloadUrl) {
      throw new Error('Не удалось сгенерировать ссылку для скачивания')
    }

    // 8. Логируем скачивание в базу данных
    try {
      await adminSupabase
        .from('download_logs')
        .insert({
          mod_id: modId,
          user_id: user.id,
          mod_name: mod.name || 'Неизвестный мод',
          is_vip_mod: isVipMod,
          download_url: downloadUrl.substring(0, 200),
          created_at: new Date().toISOString()
        })

      await adminSupabase
        .from('mods')
        .update({ 
          download_count: (mod.download_count || 0) + 1,
          last_downloaded: new Date().toISOString()
        })
        .eq('id', modId)

      console.log('✅ [DOWNLOAD] Скачивание залогировано:', mod.name)
    } catch (logError) {
      console.warn('⚠️ [DOWNLOAD] Ошибка логирования:', logError)
    }

    // 9. Отправляем ссылку обратно клиенту
    return new Response(JSON.stringify({ 
      success: true,
      signedUrl: downloadUrl,
      modName: mod.name,
      isVipMod: isVipMod,
      isExternalLink: isExternalLink,
      expiresInSeconds: isExternalLink ? 300 : 60,
      message: isExternalLink 
        ? '🔐 Уникальная ссылка сгенерирована. Действительна 5 минут.' 
        : '🔐 Уникальная ссылка сгенерирована. Действительна 60 секунд.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('❌ [DOWNLOAD] Ошибка в Edge Function:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
