// 📁 ЗАГРУЗКА VIP МОДОВ В STORAGE
// Только для админов

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
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

    // 2. Проверка админских прав
    const { data: profile, error: profileError } = await userSupabase
      .from('profiles')
      .select('role, is_banned')
      .eq('id', user.id)
      .single()

    if (profileError) throw profileError
    if (profile.is_banned) {
      throw new Error('Пользователь заблокирован')
    }

    const adminRoles = ['admin', 'admin_senior', 'owner']
    if (!adminRoles.includes(profile.role)) {
      throw new Error('Только администраторы могут загружать VIP моды')
    }

    // 3. Получаем данные формы
    const formData = await req.formData()
    const file = formData.get('file') as File
    const modId = formData.get('modId') as string
    const modName = formData.get('modName') as string

    if (!file || !modId) {
      throw new Error('Файл и ID мода обязательны')
    }

    console.log('📁 [UPLOAD] Загрузка VIP мода:', {
      modId: modId,
      modName: modName,
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type
    })

    // 4. Проверка размера файла (максимум 100MB)
    const maxSize = 100 * 1024 * 1024 // 100MB
    if (file.size > maxSize) {
      throw new Error('Размер файла не должен превышать 100MB')
    }

    // 5. Формируем имя файла
    const fileExtension = file.name.split('.').pop()
    const storagePath = `vip-mods/${modId}-${modName.replace(/[^a-zA-Z0-9а-яА-Я]/g, '_')}.${fileExtension}`

    // 6. Загружаем файл в Storage
    const adminSupabase = createAdminClient()
    const { data: uploadData, error: uploadError } = await adminSupabase.storage
      .from('private-mods')
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: true // Перезаписывать если существует
      })

    if (uploadError) {
      console.error('❌ [UPLOAD] Ошибка загрузки:', uploadError)
      throw new Error(`Ошибка загрузки файла: ${uploadError.message}`)
    }

    // 7. Обновляем информацию о моде в базе
    const { error: updateError } = await adminSupabase
      .from('mods')
      .update({
        file_path: storagePath,
        download_url: null, // Удаляем внешнюю ссылку если была
        updated_at: new Date().toISOString()
      })
      .eq('id', modId)

    if (updateError) {
      console.error('❌ [UPLOAD] Ошибка обновления мода:', updateError)
      throw new Error(`Ошибка обновления мода: ${updateError.message}`)
    }

    console.log('✅ [UPLOAD] VIP мод успешно загружен:', {
      modId: modId,
      storagePath: storagePath,
      fileName: file.name
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'VIP мод успешно загружен',
      data: {
        modId: modId,
        fileName: file.name,
        storagePath: storagePath,
        fileSize: file.size,
        uploadedAt: new Date().toISOString()
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('❌ [UPLOAD] Ошибка:', error)
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
