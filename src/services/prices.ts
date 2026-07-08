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
