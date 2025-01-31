addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, target-url',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Expose-Headers': '*',
    'Content-Type': 'application/json'
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    })
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