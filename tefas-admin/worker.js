// CORS ayarları
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

export default {
  async fetch(request, env) {
    // OPTIONS isteklerini handle et
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Login işlemi
    if (path === '/admin/login' && request.method === 'POST') {
      const { username, password } = await request.json();
      
      if (username === 'admin' && password === env.ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ 
          token: env.ADMIN_PASSWORD,
          success: true 
        }), { headers: corsHeaders });
      }
      
      return new Response(JSON.stringify({ 
        error: 'Kullanıcı adı veya şifre hatalı!',
        success: false 
      }), { 
        status: 401,
        headers: corsHeaders 
      });
    }

    // Yetkilendirme kontrolü
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== env.ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: corsHeaders
      });
    }

    // Fonları getir
    if (path === '/admin/data' && request.method === 'GET') {
      const funds = await env.ADMIN_STORE.get('funds', 'json') || {};
      return new Response(JSON.stringify({ funds }), { headers: corsHeaders });
    }

    // Varsayılan fonları ekle
    if (path === '/admin/funds/init' && request.method === 'POST') {
      const defaultFunds = {
        'TBT': {
          name: 'TEB PORTFÖY BORÇLANMA ARAÇLARI FONU',
          managementFee: 2.19
        },
        'NJR': {
          name: 'NUROL PORTFÖY BİRİNCİ BORÇLANMA ARAÇLARI FONU',
          managementFee: 1.25
        },
        'HPT': {
          name: 'HSBC PORTFÖY KISA VADELİ BORÇLANMA ARAÇLARI (TL) FONU',
          managementFee: 2.37
        }
      };
      await env.ADMIN_STORE.put('funds', JSON.stringify(defaultFunds));
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // Fon ekle/güncelle
    if (path === '/admin/funds/update' && request.method === 'POST') {
      const { code, name, managementFee } = await request.json();
      const funds = await env.ADMIN_STORE.get('funds', 'json') || {};
      funds[code] = { name, managementFee };
      await env.ADMIN_STORE.put('funds', JSON.stringify(funds));
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // Fon sil
    if (path === '/admin/funds/delete' && request.method === 'POST') {
      const { code } = await request.json();
      const funds = await env.ADMIN_STORE.get('funds', 'json') || {};
      delete funds[code];
      await env.ADMIN_STORE.put('funds', JSON.stringify(funds));
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: corsHeaders
    });
  }
}; 