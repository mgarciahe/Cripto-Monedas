import { createClient } from '@supabase/supabase-js';

// Leer de forma segura las variables de entorno utilizando la sintaxis de Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Control de seguridad: Lanzar un error descriptivo si faltan las variables en el entorno
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Error de configuración: Faltan las variables de entorno de Supabase.\n' +
    'Por favor, verifica que VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY estén definidas ' +
    'en tu archivo .env.local en la raíz del proyecto.'
  );
}
// Inicializar la instancia del cliente de Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Billetera {
  id?: string;
  usuario_id: string;
  balance_usd: number;
  balance_btc: number;
  balance_eth: number;
  balance_sol: number;
}

/**
 * Obtiene los balances de la billetera de un usuario específico desde la tabla 'billeteras'.
 * Realiza una traducción segura desde las columnas físicas (saldo_*) hacia las propiedades de frontend (balance_*).
 */
export async function getWalletBalances(userId: string): Promise<Billetera | null> {
  if (userId === 'guest-user-id') {
    return {
      id: 'e89d1b46-0c6d-4eb3-81b3-d5d852a4658e',
      usuario_id: 'guest-user-id',
      balance_usd: 11087.00,
      balance_btc: 0.125,
      balance_eth: 1.45,
      balance_sol: 18.2,
    };
  }
  const { data, error } = await supabase
    .from('billeteras')
    .select('*')
    .eq('usuario_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) return null;

  // Mapear las columnas físicas de Supabase (saldo_usd, etc.) al modelo de datos del cliente (balance_usd, etc.)
  return {
    id: data.id,
    usuario_id: data.usuario_id,
    balance_usd: Number(data.saldo_usd ?? 0),
    balance_btc: Number(data.saldo_btc ?? 0),
    balance_eth: Number(data.saldo_eth ?? 0),
    balance_sol: Number(data.saldo_sol ?? 0),
  };
}
