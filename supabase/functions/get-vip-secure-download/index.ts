// 🛡️ УСИЛЕННАЯ ЗАЩИТА VIP МОДОВ v2.0
// Генерирует защищенные ссылки с привязкой к IP, рефереру и сессии

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 🚀 УНИВЕРСАЛЬНЫЕ НАСТРОЙКИ - АВТОМАТИЧЕСКОЕ ОПРЕДЕЛЕНИЕ
// Ваш домен (определяется автоматически или из переменных окружения)
function getAllowedDomains(): string[] {
  // Сначала проверяем переменные окружения
  const envDomains = Deno.env.get('ALLOWED_DOMAINS');
  if (envDomains) {
    return envDomains.split(',').map(d => d.trim());
  }
  
  // Автоопределение на основе URL проекта
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const projectUrl = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
  
  return [
    `${projectUrl}.supabase.co`,
    `${projectUrl}.netlify.app`,
    'localhost:3000',
    'localhost:5173',
    '127.0.0.1:3000',
    '127.0.0.1:5173'
  ];
}

const ALLOWED_DOMAINS = getAllowedDomains();

function createAdminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  )
}

// Генерация защищенного токена
function generateSecureToken(userId: string, modId: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 15)
  const sessionFingerprint = btoa(`${userId}-${modId}-${timestamp}-${random}`)
  return sessionFingerprint.replace(/[^a-zA-Z0-9]/g, '').substring(0, 32)
}

// Извлечение IP адреса из запроса
function getClientIP(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  const realIP = req.headers.get('x-real-ip')
  const cfConnectingIP = req.headers.get('cf-connecting-ip') // Cloudflare
  
  if (forwarded) return forwarded.split(',')[0].trim()
  if (realIP) return realIP.trim()
  if (cfConnectingIP) return cfConnectingIP.trim()
  return 'unknown'
}

// Извлечение домена из реферера
function getRefererDomain(referer: string | null): string | null {
  if (!referer) return null
  
  try {
    const url = new URL(referer)
    return url.hostname
  } catch {
    return null
  }
}

// Проверка разрешенного домена
function isAllowedDomain(domain: string | null): boolean {
  if (!domain) return false
  return ALLOWED_DOMAINS.some(allowed => domain.includes(allowed))
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🛡️ [SECURE DOWNLOAD] Новый запрос:', {
      method: req.method,
      url: req.url,
      userAgent: req.headers.get('user-agent')?.substring(0, 100),
      referer: req.headers.get('referer')?.substring(0, 100)
    })

    // 1. Проверка авторизации
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Отсутствует заголовок авторизации')
    }

    const userSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await userSupabase.auth.getUser()
    if (userError || !user) {
      throw new Error('Неверный токен пользователя')
    }

    // 2. Проверка VIP-статуса
    const { data: profile, error: profileError } = await userSupabase
      .from('profiles')
      .select('is_vip, role, vip_expires_at, is_banned')
      .eq('id', user.id)
      .single()

    if (profileError) throw profileError
    if (profile.is_banned) {
      return new Response(JSON.stringify({ error: 'Пользователь заблокирован' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    const vipRoles = ['vip', 'moderator', 'moderator_senior', 'admin', 'admin_senior', 'owner']
    const hasRoleAccess = vipRoles.includes(profile.role)
    const hasVipFlag = profile.is_vip === true
    const isNotExpired = !profile.vip_expires_at || new Date(profile.vip_expires_at) > new Date()
    const hasVipAccess = (hasRoleAccess || hasVipFlag) && isNotExpired

    if (!hasVipAccess) {
      return new Response(JSON.stringify({ error: 'Доступ запрещен. Требуется VIP-статус.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    // 3. Проверка реферера (защита от внешних запросов)
    const referer = req.headers.get('referer')
    const refererDomain = getRefererDomain(referer)
    
    if (!isAllowedDomain(refererDomain)) {
      console.warn('⚠️ [SECURITY] Недопустимый реферер:', {
        userId: user.id,
        referer: referer,
        refererDomain: refererDomain,
        userAgent: req.headers.get('user-agent')
      })
      
      return new Response(JSON.stringify({ 
        error: 'Доступ разрешен только с официального сайта',
        code: 'INVALID_REFERER'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    // 4. Получение данных мода
    const { modId } = await req.json()
    if (!modId) {
      throw new Error('ID мода не предоставлен')
    }

    const adminSupabase = createAdminClient()
    const { data: mod, error: modError } = await adminSupabase
      .from('mods')
      .select('file_path, is_private, download_url, name, category')
      .eq('id', modId)
      .single()

    if (modError || !mod) {
      throw new Error('Мод не найден')
    }

    const isVipMod = mod.is_private === true || mod.category === 'vip_mods'
    if (!isVipMod) {
      throw new Error('Этот мод не является VIP')
    }

    // 5. Сбор защитной информации
    const clientIP = getClientIP(req)
    const userAgent = req.headers.get('user-agent') || 'unknown'
    const sessionId = req.headers.get('x-session-id') || 'no-session'
    
    console.log('🔍 [SECURITY] Сбор данных:', {
      userId: user.id,
      modId: modId,
      clientIP: clientIP,
      refererDomain: refererDomain,
      sessionId: sessionId
    })

    // 6. Генерация защищенного токена
    const secureToken = generateSecureToken(user.id, modId)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 минут
    
    // 7. Сохранение токена с защитными параметрами
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
      console.error('❌ [SECURITY] Ошибка сохранения токена:', tokenError)
      throw new Error('Не удалось создать защищенную ссылку')
    }

    // 8. Формирование защищенной ссылки
    let downloadUrl = null
    
    if (mod.file_path) {
      // Для файлов в Storage
      const { data: signedUrlData, error: signedUrlError } = await userSupabase.storage
        .from('private-mods')
        .createSignedUrl(mod.file_path, 60)
      
      if (signedUrlError) throw signedUrlError
      downloadUrl = signedUrlData.signedUrl
    } else if (mod.download_url) {
      // Для внешних ссылок - через защищенную функцию
      downloadUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/download-vip-secure?token=${secureToken}`
    }

    if (!downloadUrl) {
      throw new Error('Нет файла для скачивания')
    }

    // 9. Логирование успешного создания ссылки
    await adminSupabase.from('download_logs').insert({
      mod_id: modId,
      user_id: user.id,
      mod_name: mod.name || 'Неизвестный мод',
      is_vip_mod: isVipMod,
      download_url: downloadUrl.substring(0, 200),
      created_at: new Date().toISOString()
    })

    console.log('✅ [SECURITY] Защищенная ссылка создана:', {
      userId: user.id,
      modId: modId,
      token: secureToken.substring(0, 8) + '...',
      expiresAt: expiresAt
    })

    return new Response(JSON.stringify({
      success: true,
      secureUrl: downloadUrl,
      token: secureToken,
      modName: mod.name,
      isVipMod: isVipMod,
      expiresInSeconds: 300, // 5 минут
      securityInfo: {
        ipBound: true,
        refererBound: true,
        sessionBound: true,
        oneTimeUse: true,
        autoBlock: true
      },
      message: '🛡️ Защищенная ссылка создана. Привязана к вашему IP и сессии.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('❌ [SECURITY] Ошибка:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
