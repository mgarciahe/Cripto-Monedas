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

  // Si no existe la billetera, la creamos con el bono de bienvenida de $10,000 USD
  if (!data) {
    try {
      const { data: newWallet, error: createError } = await supabase
        .from('billeteras')
        .insert([
          {
            usuario_id: userId,
            saldo_usd: 10000.00,
            saldo_btc: 0,
            saldo_eth: 0,
            saldo_sol: 0
          }
        ])
        .select()
        .maybeSingle();

      if (createError || !newWallet) {
        console.error('Error al crear billetera inicial:', createError);
        return null;
      }

      return {
        id: newWallet.id,
        usuario_id: newWallet.usuario_id,
        balance_usd: Number(newWallet.saldo_usd ?? 10000.00),
        balance_btc: Number(newWallet.saldo_btc ?? 0),
        balance_eth: Number(newWallet.saldo_eth ?? 0),
        balance_sol: Number(newWallet.saldo_sol ?? 0),
      };
    } catch (err) {
      console.error('Excepción al crear billetera inicial:', err);
      return null;
    }
  }

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
