import { redis } from './redis';

/**
 * Interfaz de TypeScript que mapea con exactitud la estructura
 * de respuesta JSON esperada de la API de CoinGecko.
 */
export interface PreciosCripto {
  bitcoin: {
    usd: number;
  };
  ethereum: {
    usd: number;
  };
  solana: {
    usd: number;
  };
}

// Precios estáticos de contingencia en caso de caídas críticas de red o APIs
const CONTINGENCY_PRICES: PreciosCripto = {
  bitcoin: { usd: 65000.00 },
  ethereum: { usd: 3400.00 },
  solana: { usd: 145.00 }
};

/**
 * Obtiene los precios actuales de criptomonedas aplicando la estrategia Cache-Aside.
 * Primero lee de Redis (clave 'crypto:prices'). Si no existe (Cache Miss), consulta a CoinGecko,
 * guarda la respuesta en Redis con un TTL de 60 segundos y la retorna. En caso de fallo total,
 * devuelve saldos de contingencia seguros.
 */
export async function getCryptoPrices(): Promise<PreciosCripto> {
  const cacheKey = 'crypto:prices';

  // 1. Lectura de Caché (Cache Hit)
  try {
    const cachedData = await redis.get<string | PreciosCripto>(cacheKey);
    if (cachedData) {
      if (typeof cachedData === 'string') {
        const parsed: PreciosCripto = JSON.parse(cachedData);
        if (parsed.bitcoin?.usd && parsed.ethereum?.usd && parsed.solana?.usd) {
          return parsed;
        }
      } else {
        if (cachedData.bitcoin?.usd && cachedData.ethereum?.usd && cachedData.solana?.usd) {
          return cachedData;
        }
      }
    }
  } catch (err: unknown) {
    // Silenciar fallo en Redis y continuar para no romper la experiencia de usuario
    console.error('Error al intentar leer de la caché NoSQL de Redis:', err);
  }

  // 2. Consulta de Respaldo (Cache Miss)
  try {
    const url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd';
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status} ${response.statusText}`);
    }
    
    const data: PreciosCripto = await response.json();
    
    // Validación estricta de estructura
    if (!data.bitcoin?.usd || !data.ethereum?.usd || !data.solana?.usd) {
      throw new Error('Datos recibidos de CoinGecko incompletos.');
    }

    // 3. Escritura en caché con TTL de 60 segundos
    try {
      await redis.set(cacheKey, JSON.stringify(data), { ex: 60 });
    } catch (cacheErr: unknown) {
      console.error('Error al guardar datos en la caché de Redis:', cacheErr);
    }

    return data;
  } catch (err: unknown) {
    console.error('Fallo en consulta de precios en vivo (retornando contingencia):', err);
    // 4. Manejo de Errores Robustos: Retornar precios de respaldo
    return CONTINGENCY_PRICES;
  }
}

// Historial estático de contingencia en caso de caídas de red o bloqueos de la API pública
const CONTINGENCY_HISTORY: Record<string, [number, number][]> = {
  bitcoin: [
    [Date.now() - 6 * 24 * 60 * 60 * 1000, 61200],
    [Date.now() - 5 * 24 * 60 * 60 * 1000, 61800],
    [Date.now() - 4 * 24 * 60 * 60 * 1000, 60900],
    [Date.now() - 3 * 24 * 60 * 60 * 1000, 62400],
    [Date.now() - 2 * 24 * 60 * 60 * 1000, 62100],
    [Date.now() - 1 * 24 * 60 * 60 * 1000, 63000],
    [Date.now(), 62522]
  ],
  ethereum: [
    [Date.now() - 6 * 24 * 60 * 60 * 1000, 1680],
    [Date.now() - 5 * 24 * 60 * 60 * 1000, 1720],
    [Date.now() - 4 * 24 * 60 * 60 * 1000, 1700],
    [Date.now() - 3 * 24 * 60 * 60 * 1000, 1780],
    [Date.now() - 2 * 24 * 60 * 60 * 1000, 1740],
    [Date.now() - 1 * 24 * 60 * 60 * 1000, 1800],
    [Date.now(), 1747]
  ],
  solana: [
    [Date.now() - 6 * 24 * 60 * 60 * 1000, 72.4],
    [Date.now() - 5 * 24 * 60 * 60 * 1000, 75.1],
    [Date.now() - 4 * 24 * 60 * 60 * 1000, 73.8],
    [Date.now() - 3 * 24 * 60 * 60 * 1000, 79.5],
    [Date.now() - 2 * 24 * 60 * 60 * 1000, 77.2],
    [Date.now() - 1 * 24 * 60 * 60 * 1000, 81.3],
    [Date.now(), 78.2]
  ]
};

export interface MarketChartResponse {
  prices: [number, number][];
}

/**
 * Obtiene el histórico de precios de los últimos 7 días de una criptomoneda específica.
 * Aplica estrategia Cache-Aside sobre Redis (clave 'crypto:history:${coinId}') con un TTL de 5 minutos (300s)
 * para evitar rate-limits de la API de CoinGecko. Retorna datos de contingencia en caso de error.
 */
export async function getCryptoHistory(coinId: string): Promise<[number, number][]> {
  const cacheKey = `crypto:history:${coinId}`;

  // 1. Intentar obtener de Caché (Redis)
  try {
    const cachedData = await redis.get<string | [number, number][]>(cacheKey);
    if (cachedData) {
      if (typeof cachedData === 'string') {
        const parsed = JSON.parse(cachedData) as [number, number][];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } else {
        if (Array.isArray(cachedData) && cachedData.length > 0) {
          return cachedData;
        }
      }
    }
  } catch (err: unknown) {
    console.error(`Error al leer caché de historial para ${coinId}:`, err);
  }

  // 2. Consulta a la API de CoinGecko
  try {
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=7`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Error HTTP de CoinGecko: ${response.status} ${response.statusText}`);
    }
    
    const data: MarketChartResponse = await response.json();
    if (!data || !Array.isArray(data.prices) || data.prices.length === 0) {
      throw new Error('Formato de historial de CoinGecko inválido o vacío.');
    }

    // 3. Escribir en caché Redis con un TTL de 300 segundos (5 minutos)
    try {
      await redis.set(cacheKey, JSON.stringify(data.prices), { ex: 300 });
    } catch (cacheErr: unknown) {
      console.error(`Error al escribir caché de historial para ${coinId}:`, cacheErr);
    }

    return data.prices;
  } catch (err: unknown) {
    console.error(`Fallo al consultar historial en CoinGecko para ${coinId} (retornando contingencia):`, err);
    // 4. Retornar datos simulados de contingencia
    return CONTINGENCY_HISTORY[coinId] || CONTINGENCY_HISTORY.bitcoin;
  }
}

