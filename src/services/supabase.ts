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
  usuario_id: string;
  balance_usd: number;
  balance_btc: number;
  balance_eth: number;
  balance_sol: number;
}

/**
 * Obtiene los balances de la billetera de un usuario específico desde la tabla 'billeteras'.
 */
export async function getWalletBalances(userId: string): Promise<Billetera | null> {
  const { data, error } = await supabase
    .from('billeteras')
    .select('*')
    .eq('usuario_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}
