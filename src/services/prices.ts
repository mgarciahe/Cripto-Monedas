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

/**
 * Obtiene los precios actuales en USD para Bitcoin, Ethereum y Solana
 * desde la API pública de CoinGecko.
 */
export async function getCryptoPrices(): Promise<PreciosCripto> {
  const url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd';
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Error en la API de CoinGecko: ${response.status} ${response.statusText}`);
  }
  
  const data: PreciosCripto = await response.json();
  
  // Validar la estructura básica de la respuesta
  if (!data.bitcoin?.usd || !data.ethereum?.usd || !data.solana?.usd) {
    throw new Error('Formato de datos de CoinGecko inválido o incompleto.');
  }
  
  return data;
}
