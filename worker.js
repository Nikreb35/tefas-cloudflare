// CORS ayarları
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://tefas-cloudflare.pages.dev',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS, PUT, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, target-url',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'true',
  'Content-Type': 'application/json'
};

// Admin token'ı environment variable'dan al
let ADMIN_PASSWORD;

// Ziyaretçi bilgilerini kaydet
async function logVisitor(request, env) {
  const cf = request.cf; // Cloudflare bilgileri
  const timestamp = new Date().toISOString();
  
  // Tarayıcı tespiti
  const ua = request.headers.get('user-agent') || 'Unknown';
  let browser = 'Other';
  if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edge')) browser = 'Edge';
  
  const visitorInfo = {
    timestamp,
    ip: cf?.ip || request.headers.get('cf-connecting-ip'),
    country: cf?.country || 'Unknown',
    city: cf?.city || 'Unknown',
    continent: cf?.continent || 'Unknown',
    userAgent: ua,
    browser: browser,
    referer: request.headers.get('referer') || 'Direct',
    requestUrl: request.url,
    language: request.headers.get('accept-language')
  };

  try {
    // Ziyaretçi listesini al
    let visitors = await env.ADMIN_STORE.get('visitors', 'json') || [];
    visitors.unshift(visitorInfo); // Yeni ziyaretçiyi başa ekle
    
    // Son 1000 ziyaretçiyi tut
    if (visitors.length > 1000) {
      visitors = visitors.slice(0, 1000);
    }

    // İstatistikleri güncelle
    let stats = await env.ADMIN_STORE.get('stats', 'json') || {
      totalVisits: 0,
      countries: {},
      browsers: {},
      hourly: Array(24).fill(0),
      daily: {},
      referers: {}
    };

    // Temel istatistikleri güncelle
    stats.totalVisits++;
    stats.countries[visitorInfo.country] = (stats.countries[visitorInfo.country] || 0) + 1;
    stats.browsers[browser] = (stats.browsers[browser] || 0) + 1;
    
    // Saatlik istatistik
    const hour = new Date(timestamp).getHours();
    stats.hourly[hour]++;
    
    // Günlük istatistik
    const today = new Date(timestamp).toISOString().split('T')[0];
    stats.daily[today] = (stats.daily[today] || 0) + 1;
    
    // Referrer istatistiği
    const referer = visitorInfo.referer === 'Direct' ? 'Direct' : new URL(visitorInfo.referer).hostname;
    stats.referers[referer] = (stats.referers[referer] || 0) + 1;

    // Verileri kaydet
    await Promise.all([
      env.ADMIN_STORE.put('visitors', JSON.stringify(visitors)),
      env.ADMIN_STORE.put('stats', JSON.stringify(stats))
    ]);

  } catch (error) {
    console.error('Ziyaretçi kaydı hatası:', error);
  }
}

// Admin paneli için yetkilendirme
async function handleAuth(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: corsHeaders
    });
  }
  const token = authHeader.split(' ')[1];
  if (token !== ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: corsHeaders
    });
  }
  return null;
}

// Admin panel işlemleri
async function handleAdminRequest(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  const authError = await handleAuth(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const path = url.pathname;

  // GET istekleri
  if (request.method === 'GET') {
    // Tüm verileri getir
    if (path === '/admin/data') {
      const funds = await env.ADMIN_STORE.get('funds', 'json') || {};
      const users = await env.ADMIN_STORE.get('users', 'json') || {};
      const visitors = await env.ADMIN_STORE.get('visitors', 'json') || [];
      const stats = await env.ADMIN_STORE.get('stats', 'json') || {};
      
      return new Response(JSON.stringify({ funds, users, visitors, stats }), {
        headers: corsHeaders
      });
    }

    // Sadece istatistikleri getir
    if (path === '/admin/stats') {
      const stats = await env.ADMIN_STORE.get('stats', 'json') || {};
      return new Response(JSON.stringify(stats), {
        headers: corsHeaders
      });
    }

    // Son ziyaretçileri getir
    if (path === '/admin/visitors') {
      const visitors = await env.ADMIN_STORE.get('visitors', 'json') || [];
      return new Response(JSON.stringify(visitors), {
        headers: corsHeaders
      });
    }
  }

  // POST istekleri
  if (request.method === 'POST') {
    // Login işlemi
    if (path === '/admin/login') {
      const { username, password } = await request.json();
      
      if (username === 'admin' && password === env.ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ 
          token: env.ADMIN_PASSWORD,
          success: true 
        }), {
          headers: corsHeaders
        });
      }
      
      return new Response(JSON.stringify({ 
        error: 'Kullanıcı adı veya şifre hatalı!',
        success: false 
      }), {
        status: 401,
        headers: corsHeaders
      });
    }

    const data = await request.json();

    // Fon ekleme
    if (path === '/admin/funds/add') {
      const { code, name, managementFee } = data;
      const funds = await env.ADMIN_STORE.get('funds', 'json') || {};
      funds[code] = { 
        name,
        managementFee,
        addedAt: new Date().toISOString()
      };
      await env.ADMIN_STORE.put('funds', JSON.stringify(funds));
      
      return new Response(JSON.stringify({ success: true }), {
        headers: corsHeaders
      });
    }

    // Fon güncelleme
    if (path === '/admin/funds/update') {
      const { code, name, managementFee } = data;
      const funds = await env.ADMIN_STORE.get('funds', 'json') || {};
      if (!funds[code]) {
        return new Response(JSON.stringify({ error: 'Fon bulunamadı' }), {
          status: 404,
          headers: corsHeaders
        });
      }
      funds[code] = { 
        ...funds[code],
        name,
        managementFee,
        updatedAt: new Date().toISOString()
      };
      await env.ADMIN_STORE.put('funds', JSON.stringify(funds));
      
      return new Response(JSON.stringify({ success: true }), {
        headers: corsHeaders
      });
    }

    // Fon silme
    if (path === '/admin/funds/delete') {
      const { code } = data;
      const funds = await env.ADMIN_STORE.get('funds', 'json') || {};
      delete funds[code];
      await env.ADMIN_STORE.put('funds', JSON.stringify(funds));
      
      return new Response(JSON.stringify({ success: true }), {
        headers: corsHeaders
      });
    }

    // Tüm fonları silme
    if (path === '/admin/funds/clear') {
      await env.ADMIN_STORE.put('funds', JSON.stringify({}));
      return new Response(JSON.stringify({ success: true }), {
        headers: corsHeaders
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: corsHeaders
  });
}

// Proxy işlemleri
async function handleProxyRequest(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Ziyaretçi bilgilerini kaydet
    await logVisitor(request, env);

    const targetUrl = request.headers.get('target-url');
    if (!targetUrl) {
      throw new Error('target-url header gerekli');
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
    };

    const response = await fetch(targetUrl, fetchOptions);
    
    if (!response.ok) {
      throw new Error(`Hedef sunucu hatası: ${response.status} ${response.statusText}`);
    }

    const body = await response.text();
    
    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache'
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: err.message.includes('target-url') ? 400 : 500,
      headers: corsHeaders
    });
  }
}

// Ana handler
export default {
  async fetch(request, env, ctx) {
    // Admin token'ı al
    ADMIN_PASSWORD = env.ADMIN_PASSWORD;

    const url = new URL(request.url);

    // İlk çalıştırmada varsayılan fonları ekle
    const funds = await env.ADMIN_STORE.get('funds', 'json');
    if (!funds) {
      const defaultFunds = {
        'NJR': {
          name: 'Neo Portföy Yeni Teknolojiler Değişken Fon',
          managementFee: 3.65
        },
        'TI2': {
          name: 'İş Portföy Elektrikli Araçlar Karma Fon',
          managementFee: 3.65
        },
        'HPT': {
          name: 'HSBC Portföy Teknoloji Şirketleri Fonu',
          managementFee: 3.65
        }
      };
      await env.ADMIN_STORE.put('funds', JSON.stringify(defaultFunds));
    }

    // Admin endpoint kontrolü
    if (url.pathname.startsWith('/admin')) {
      return handleAdminRequest(request, env);
    }
    
    // Proxy isteği
    return handleProxyRequest(request, env);
  }
}; 