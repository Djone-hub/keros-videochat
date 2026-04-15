// 🛡️ ЗАЩИЩЕННОЕ СКАЧИВАНИЕ VIP МОДОВ
// Проверяет токен и блокирует при попытке передачи

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function createAdminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  )
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

// Отправка уведомления админам
async function notifyAdmins(adminSupabase: any, violation: any) {
  try {
    // Получаем всех админов
    const { data: admins } = await adminSupabase
      .from('profiles')
      .select('id, email, username')
      .in('role', ['admin', 'admin_senior', 'owner'])
      .eq('is_banned', false)

    if (admins && admins.length > 0) {
      // Здесь можно добавить отправку email, уведомлений в Telegram и т.д.
      console.log('🚨 [SECURITY] УВЕДОМЛЕНИЕ АДМИНАМ:', {
        violation: violation.violation_type,
        userId: violation.user_id,
        userIP: violation.user_ip,
        adminCount: admins.length
      })
      
      // Отмечаем что админы уведомлены
      await adminSupabase
        .from('security_violations')
        .update({ 
          admin_notified: true, 
          admin_notified_at: new Date().toISOString() 
        })
        .eq('id', violation.id)
    }
  } catch (error) {
    console.error('❌ [SECURITY] Ошибка уведомления админов:', error)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔍 [SECURE DOWNLOAD] Проверка токена:', {
      url: req.url,
      userAgent: req.headers.get('user-agent')?.substring(0, 100)
    })

    // 1. Получаем токен из URL параметра
    const url = new URL(req.url)
    const token = url.searchParams.get('token')
    
    if (!token) {
      return new Response(JSON.stringify({ error: 'Токен не предоставлен' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // 2. Получаем информацию о запросе
    const clientIP = getClientIP(req)
    const userAgent = req.headers.get('user-agent') || 'unknown'
    const referer = req.headers.get('referer')
    const refererDomain = getRefererDomain(referer)
    const sessionId = req.headers.get('x-session-id') || 'no-session'

    // 3. Проверяем токен через функцию безопасности
    const adminSupabase = createAdminClient()
    
    // Сначала получаем запись токена
    const { data: tokenRecord, error: tokenError } = await adminSupabase
      .from('vip_download_tokens')
      .select('*')
      .eq('token', token)
      .single()

    if (tokenError || !tokenRecord) {
      console.warn('⚠️ [SECURITY] Попытка доступа с несуществующим токеном:', {
        token: token.substring(0, 8) + '...',
        clientIP: clientIP,
        userAgent: userAgent
      })
      
      return new Response(JSON.stringify({ 
        error: 'Недействительная ссылка для скачивания',
        code: 'INVALID_TOKEN'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    // 4. Проверяем блокировку
    if (tokenRecord.is_blocked) {
      console.warn('🚫 [SECURITY] Попытка доступа к заблокированному токену:', {
        tokenId: tokenRecord.id,
        userId: tokenRecord.user_id,
        blockReason: tokenRecord.block_reason,
        clientIP: clientIP
      })
      
      return new Response(JSON.stringify({ 
        error: 'Ссылка была заблокирована из-за нарушения безопасности',
        code: 'TOKEN_BLOCKED',
        reason: tokenRecord.block_reason
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    // 5. Проверяем истечение
    if (new Date(tokenRecord.expires_at) < new Date()) {
      // Блокируем просроченный токен
      await adminSupabase
        .from('vip_download_tokens')
        .update({ 
          is_blocked: true, 
          block_reason: 'TOKEN_EXPIRED' 
        })
        .eq('id', tokenRecord.id)

      // Логируем нарушение
      const { data: violation } = await adminSupabase
        .from('security_violations')
        .insert({
          token_id: tokenRecord.id,
          user_id: tokenRecord.user_id,
          mod_id: tokenRecord.mod_id,
          violation_type: 'EXPIRED_ACCESS',
          user_ip: clientIP,
          user_agent: userAgent,
          referer: referer,
          action_taken: 'BLOCKED_TOKEN'
        })
        .select()
        .single()

      // Уведомляем админов
      if (violation) {
        await notifyAdmins(adminSupabase, violation)
      }

      return new Response(JSON.stringify({ 
        error: 'Ссылка истекла. Запросите новую.',
        code: 'TOKEN_EXPIRED'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    // 6. ПРОВЕРКИ БЕЗОПАСНОСТИ
    
    let violationDetected = false
    let violationType = null
    let blockReason = null

    // Проверка IP адреса
    if (tokenRecord.user_ip !== clientIP) {
      violationDetected = true
      violationType = 'IP_MISMATCH'
      blockReason = 'IP адрес не совпадает с исходным. Возможна передача ссылки.'
      
      console.warn('🚨 [SECURITY] Обнаружено несоответствие IP:', {
        tokenId: tokenRecord.id,
        originalIP: tokenRecord.user_ip,
        currentIP: clientIP,
        userId: tokenRecord.user_id
      })
    }

    // Проверка реферера (должен быть с вашего сайта)
    const allowedDomains = ['your-domain.com', 'localhost:3000', 'localhost:5173']
    if (refererDomain && !allowedDomains.some(domain => refererDomain.includes(domain))) {
      violationDetected = true
      violationType = violationType || 'REFERER_MISMATCH'
      blockReason = blockReason || 'Доступ с недопустимого сайта'
      
      console.warn('🚨 [SECURITY] Недопустимый реферер:', {
        tokenId: tokenRecord.id,
        refererDomain: refererDomain,
        userId: tokenRecord.user_id
      })
    }

    // Проверка сессии
    if (tokenRecord.session_id !== sessionId) {
      violationDetected = true
      violationType = violationType || 'TOKEN_SHARING'
      blockReason = blockReason || 'Обнаружена попытка передачи ссылки другому пользователю'
      
      console.warn('🚨 [SECURITY] Обнаружена передача токена:', {
        tokenId: tokenRecord.id,
        originalSession: tokenRecord.session_id,
        currentSession: sessionId,
        userId: tokenRecord.user_id
      })
    }

    // 7. ЕСЛИ ОБНАРУЖЕНО НАРУШЕНИЕ
    if (violationDetected) {
      // Блокируем токен
      await adminSupabase
        .from('vip_download_tokens')
        .update({ 
          is_blocked: true, 
          block_reason: blockReason,
          security_violations: tokenRecord.security_violations + 1
        })
        .eq('id', tokenRecord.id)

      // Логируем серьезное нарушение
      const { data: violation } = await adminSupabase
        .from('security_violations')
        .insert({
          token_id: tokenRecord.id,
          user_id: tokenRecord.user_id,
          mod_id: tokenRecord.mod_id,
          violation_type: violationType,
          user_ip: clientIP,
          user_agent: userAgent,
          referer: referer,
          action_taken: 'BLOCKED_TOKEN',
          details: {
            original_ip: tokenRecord.user_ip,
            original_session: tokenRecord.session_id,
            original_referer: tokenRecord.referer_domain
          }
        })
        .select()
        .single()

      // Немедленно уведомляем админов о нарушении
      if (violation) {
        await notifyAdmins(adminSupabase, violation)
      }

      return new Response(JSON.stringify({ 
        error: '🚨 Обнаружено нарушение безопасности! Ссылка заблокирована.',
        code: 'SECURITY_VIOLATION',
        violationType: violationType,
        blockReason: blockReason
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    // 8. ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ - РАЗРЕШАЕМ СКАЧИВАНИЕ
    
    // Обновляем статистику
    await adminSupabase
      .from('vip_download_tokens')
      .update({ 
        used_at: new Date().toISOString(),
        last_accessed_at: new Date().toISOString(),
        access_count: tokenRecord.access_count + 1
      })
      .eq('id', tokenRecord.id)

    // Логируем успешное скачивание
    await adminSupabase.from('download_logs').insert({
      mod_id: tokenRecord.mod_id,
      user_id: tokenRecord.user_id,
      mod_name: 'VIP мод (защищенное скачивание)',
      is_vip_mod: true,
      download_url: tokenRecord.external_url?.substring(0, 200),
      created_at: new Date().toISOString()
    })

    console.log('✅ [SECURE DOWNLOAD] Успешное скачивание:', {
      tokenId: tokenRecord.id,
      userId: tokenRecord.user_id,
      modId: tokenRecord.mod_id,
      clientIP: clientIP
    })

    // Перенаправляем на оригинальный URL
    return new Response(null, {
      status: 302,
      headers: { 
        'Location': tokenRecord.external_url,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('❌ [SECURE DOWNLOAD] Критическая ошибка:', error)
    return new Response(JSON.stringify({ error: 'Внутренняя ошибка сервера' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
