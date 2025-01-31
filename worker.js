addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS, PUT, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, target-url',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Expose-Headers': '*'
}

// Admin bilgilerini environment variables'dan al
const ADMIN_CREDENTIALS = {
  username: ADMIN_USERNAME || 'admin', // Fallback değer
  password: ADMIN_PASSWORD // Environment variable'dan al
}

// Aktif fonlar listesi
let ACTIVE_FUNDS = [
  { code: 'NJR', name: 'NUROL PORTFÖY BİRİNCİ BORÇLANMA ARAÇLARI FONU', active: true },
  { code: 'TBT', name: 'TEB PORTFÖY BORÇLANMA ARAÇLARI FONU', active: true },
  { code: 'HPT', name: 'HSBC PORTFÖY KISA VADELİ BORÇLANMA ARAÇLARI (TL) FONU', active: true }
]

// Token kontrolü fonksiyonu
async function verifyToken(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Token gerekli' }), {
      status: 401,
      headers: corsHeaders
    });
  }

  const token = authHeader.split(' ')[1];
  if (token !== ADMIN_CREDENTIALS.password) {
    return new Response(JSON.stringify({ error: 'Geçersiz token' }), {
      status: 401,
      headers: corsHeaders
    });
  }

  return null;
}

async function handleRequest(request) {
  // OPTIONS isteği için CORS headers döndür
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    })
  }

  const url = new URL(request.url)
  
  // Admin işlemleri için endpoint'ler
  if (url.pathname === '/admin/login') {
    return handleAdminLogin(request)
  }

  // Token kontrolü gerektiren endpoint'ler
  if (url.pathname === '/admin/change-password' || url.pathname === '/admin/funds') {
    const tokenError = await verifyToken(request);
    if (tokenError) return tokenError;
  }
  
  if (url.pathname === '/admin/change-password') {
    return handleChangePassword(request)
  }

  // Fon yönetimi endpoint'leri
  if (url.pathname === '/admin/funds') {
    switch (request.method) {
      case 'GET':
        return handleGetFunds()
      case 'POST':
        return handleAddFund(request)
      case 'PUT':
        return handleUpdateFund(request)
      case 'DELETE':
        return handleDeleteFund(request)
      default:
        return new Response('Method not allowed', { 
          status: 405, 
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        })
    }
  }

  try {
    const targetUrl = request.headers.get('target-url')
    if (!targetUrl) {
      throw new Error('target-url header gerekli')
    }

    const fetchOptions = {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      redirect: 'follow'
    }

    const response = await fetch(targetUrl, fetchOptions)
    
    if (!response.ok) {
      throw new Error(`Hedef sunucu hatası: ${response.status} ${response.statusText}`)
    }

    const body = await response.text()
    
    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache'
      }
    })

  } catch (err) {
    console.error('Hata:', err)
    return new Response(JSON.stringify({ error: err.message }), { 
      status: err.message.includes('target-url') ? 400 : 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    })
  }
}

async function handleAdminLogin(request) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    })
  }

  try {
    const { username, password } = await request.json()

    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
      return new Response(JSON.stringify({ success: true }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      })
    }

    return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
      status: 401,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    })
  }
}

async function handleChangePassword(request) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    })
  }

  try {
    const { currentPassword, newPassword } = await request.json()

    if (currentPassword !== ADMIN_CREDENTIALS.password) {
      return new Response(JSON.stringify({ error: 'Mevcut şifre yanlış' }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      })
    }

    if (!newPassword || newPassword.length < 6) {
      return new Response(JSON.stringify({ error: 'Yeni şifre en az 6 karakter olmalıdır' }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      })
    }

    // Şifreyi güncelle
    ADMIN_CREDENTIALS.password = newPassword

    return new Response(JSON.stringify({ success: true, message: 'Şifre başarıyla değiştirildi' }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Şifre değiştirme işlemi başarısız' }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    })
  }
}

// Fon yönetimi fonksiyonları
async function handleGetFunds() {
  return new Response(JSON.stringify(ACTIVE_FUNDS), {
    headers: corsHeaders
  })
}

async function handleAddFund(request) {
  try {
    const fund = await request.json()
    
    if (!fund.code || !fund.name) {
      return new Response(JSON.stringify({ error: 'Fon kodu ve adı gerekli' }), {
        status: 400,
        headers: corsHeaders
      })
    }

    if (ACTIVE_FUNDS.some(f => f.code === fund.code)) {
      return new Response(JSON.stringify({ error: 'Bu fon kodu zaten kullanılıyor' }), {
        status: 400,
        headers: corsHeaders
      })
    }

    ACTIVE_FUNDS.push({
      code: fund.code,
      name: fund.name,
      active: fund.active !== false
    })

    return new Response(JSON.stringify({ success: true, message: 'Fon başarıyla eklendi' }), {
      headers: corsHeaders
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Fon ekleme işlemi başarısız' }), {
      status: 500,
      headers: corsHeaders
    })
  }
}

async function handleUpdateFund(request) {
  try {
    const fund = await request.json()
    
    if (!fund.code || !fund.name) {
      return new Response(JSON.stringify({ error: 'Fon kodu ve adı gerekli' }), {
        status: 400,
        headers: corsHeaders
      })
    }

    const index = ACTIVE_FUNDS.findIndex(f => f.code === fund.code)
    if (index === -1) {
      return new Response(JSON.stringify({ error: 'Fon bulunamadı' }), {
        status: 404,
        headers: corsHeaders
      })
    }

    ACTIVE_FUNDS[index] = {
      code: fund.code,
      name: fund.name,
      active: fund.active !== false
    }

    return new Response(JSON.stringify({ success: true, message: 'Fon başarıyla güncellendi' }), {
      headers: corsHeaders
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Fon güncelleme işlemi başarısız' }), {
      status: 500,
      headers: corsHeaders
    })
  }
}

async function handleDeleteFund(request) {
  try {
    const { code } = await request.json()
    
    if (!code) {
      return new Response(JSON.stringify({ error: 'Fon kodu gerekli' }), {
        status: 400,
        headers: corsHeaders
      })
    }

    const index = ACTIVE_FUNDS.findIndex(f => f.code === code)
    if (index === -1) {
      return new Response(JSON.stringify({ error: 'Fon bulunamadı' }), {
        status: 404,
        headers: corsHeaders
      })
    }

    ACTIVE_FUNDS.splice(index, 1)

    return new Response(JSON.stringify({ success: true, message: 'Fon başarıyla silindi' }), {
      headers: corsHeaders
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Fon silme işlemi başarısız' }), {
      status: 500,
      headers: corsHeaders
    })
  }
} 