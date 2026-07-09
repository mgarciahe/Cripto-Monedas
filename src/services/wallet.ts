import { supabase } from './supabase';

/**
 * Interfaz que define la estructura de una Oferta P2P en el sistema.
 */
export interface OfertaP2P {
  id: string;
  vendedor_id: string;
  moneda_cripto: string;
  monto: number;
  precio_unid: number;
  estado: string;
  created_at?: string;
}

/**
 * Realiza una transferencia de fondos entre dos usuarios llamando a la función RPC 'transferir_fondos' en Supabase.
 * 
 * @param remitenteId ID del usuario que envía los fondos.
 * @param destinatarioId ID del usuario que recibe los fondos.
 * @param moneda Nombre de la columna de moneda en la tabla (ej. 'balance_usd', 'balance_btc', 'balance_eth', 'balance_sol').
 * @param monto Cantidad de fondos a transferir.
 * @returns Un objeto indicando el éxito de la operación y el mensaje resultante.
 */
export async function transferFunds(
  remitenteId: string,
  destinatarioId: string,
  moneda: string,
  monto: number
): Promise<{ success: boolean; message: string }> {
  try {
    // Traducir el identificador del frontend (balance_*) al nombre de columna física en la DB (saldo_*)
    let dbMoneda = moneda;
    if (moneda === 'balance_usd') dbMoneda = 'saldo_usd';
    else if (moneda === 'balance_btc') dbMoneda = 'saldo_btc';
    else if (moneda === 'balance_eth') dbMoneda = 'saldo_eth';
    else if (moneda === 'balance_sol') dbMoneda = 'saldo_sol';

    const { error } = await supabase.rpc('transferir_fondos', {
      remitente_id: remitenteId,
      destinatario_id: destinatarioId,
      columna_moneda: dbMoneda,
      monto: monto
    });

    if (error) {
      throw new Error(error.message);
    }

    return {
      success: true,
      message: 'Transferencia realizada con éxito.'
    };
  } catch (err: unknown) {
    console.error('Error al transferir fondos:', err);
    const msg = err instanceof Error ? err.message : 'Ocurrió un error inesperado al procesar la transferencia.';
    return {
      success: false,
      message: msg
    };
  }
}

/**
 * Publica una nueva oferta P2P en la plataforma llamando a la función RPC 'publicar_oferta_p2p'.
 * 
 * @param vendedorId ID del usuario que vende las criptomonedas.
 * @param moneda Código de la moneda criptográfica (ej: 'BTC', 'ETH', 'SOL').
 * @param monto Cantidad de criptomonedas a vender.
 * @param precioUnidad Precio unitario en USD por cada unidad criptográfica.
 * @returns Objeto de éxito o fracaso con mensaje descriptivo.
 */
export async function createP2POffer(
  vendedorId: string,
  moneda: string,
  monto: number,
  precioUnidad: number
): Promise<{ success: boolean; message: string }> {
  try {
    const { error } = await supabase.rpc('publicar_oferta_p2p', {
      vendedor_uuid: vendedorId,
      moneda_cripto: moneda,
      monto: monto,
      precio_unid: precioUnidad
    });

    if (error) {
      throw new Error(error.message);
    }

    return {
      success: true,
      message: 'Oferta P2P publicada con éxito.'
    };
  } catch (err: unknown) {
    console.error('Error al publicar oferta P2P:', err);
    const msg = err instanceof Error ? err.message : 'Ocurrió un error inesperado al publicar la oferta P2P.';
    return {
      success: false,
      message: msg
    };
  }
}

/**
 * Ejecuta la compra de una oferta P2P activa llamando a la función RPC 'comprar_oferta_p2p'.
 * 
 * @param ofertaId ID único de la oferta (UUID).
 * @param compradorId ID del usuario que compra y recibe las criptomonedas.
 * @returns Objeto de éxito o fracaso con mensaje descriptivo.
 */
export async function buyP2POffer(
  ofertaId: string,
  compradorId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const { error } = await supabase.rpc('comprar_oferta_p2p', {
      oferta_uuid: ofertaId,
      comprador_uuid: compradorId
    });

    if (error) {
      throw new Error(error.message);
    }

    return {
      success: true,
      message: 'Compra P2P completada con éxito.'
    };
  } catch (err: unknown) {
    console.error('Error al realizar compra P2P:', err);
    const msg = err instanceof Error ? err.message : 'Ocurrió un error inesperado al procesar la compra P2P.';
    return {
      success: false,
      message: msg
    };
  }
}

/**
 * Consulta todas las ofertas de venta P2P activas disponibles en el mercado.
 * 
 * @returns Listado de ofertas activas.
 */
export async function getActiveOffers(): Promise<{ success: boolean; message: string; data?: OfertaP2P[] }> {
  try {
    const { data, error } = await supabase
      .from('ofertas_p2p')
      .select('*')
      .eq('estado', 'activa');

    if (error) {
      throw new Error(error.message);
    }

    return {
      success: true,
      message: 'Ofertas activas obtenidas con éxito.',
      data: data as OfertaP2P[]
    };
  } catch (err: unknown) {
    console.error('Error al obtener ofertas P2P activas:', err);
    const msg = err instanceof Error ? err.message : 'Ocurrió un error inesperado al obtener ofertas P2P.';
    return {
      success: false,
      message: msg
    };
  }
}

/**
 * Permite recargar el saldo de USD del usuario en la base de datos de Supabase.
 * Si la billetera del usuario no existe, la crea dinámicamente con el monto.
 */
export async function reloadBalance(
  userId: string,
  amount: number
): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Consultar si ya existe la billetera
    const { data: existingWallet, error: fetchError } = await supabase
      .from('billeteras')
      .select('*')
      .eq('usuario_id', userId)
      .maybeSingle();

    if (fetchError) {
      throw new Error(fetchError.message);
    }

    if (existingWallet) {
      // 2. Sumar el monto al saldo actual
      const nuevoSaldo = Number(existingWallet.saldo_usd ?? 0) + amount;
      const { error: updateError } = await supabase
        .from('billeteras')
        .update({ saldo_usd: nuevoSaldo, actualizado_en: new Date().toISOString() })
        .eq('usuario_id', userId);

      if (updateError) {
        throw new Error(updateError.message);
      }
    } else {
      // 3. Si no existe, crear la fila inicial
      const { error: insertError } = await supabase
        .from('billeteras')
        .insert({
          usuario_id: userId,
          saldo_usd: amount,
          saldo_btc: 0.00000000,
          saldo_eth: 0.00000000,
          saldo_sol: 0.00000000
        });

      if (insertError) {
        throw new Error(insertError.message);
      }
    }

    // Registrar el movimiento de recarga en la base de datos
    await supabase.from('movimientos').insert({
      usuario_id: userId,
      tipo: 'deposito',
      detalle: 'Recarga de saldo USD',
      monto_usd: amount,
      moneda: 'USD'
    });

    return {
      success: true,
      message: `Se han recargado $${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD a tu billetera.`
    };
  } catch (err: unknown) {
    console.error('Error al recargar saldo:', err);
    const msg = err instanceof Error ? err.message : 'Error al procesar la recarga de saldo.';
    return {
      success: false,
      message: msg
    };
  }
}

/**
 * Compra de forma ficticia criptomonedas utilizando el saldo de USD actual.
 * Descuenta del saldo de USD y añade la proporción calculada a la criptomoneda elegida.
 */
export async function buyCrypto(
  userId: string,
  crypto: 'btc' | 'eth' | 'sol',
  usdAmount: number,
  coinPrice: number
): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Consultar billetera actual
    const { data: existingWallet, error: fetchError } = await supabase
      .from('billeteras')
      .select('*')
      .eq('usuario_id', userId)
      .maybeSingle();

    if (fetchError) {
      throw new Error(fetchError.message);
    }

    if (!existingWallet) {
      throw new Error('No se encontró una billetera registrada para este usuario.');
    }

    const currentUsd = Number(existingWallet.saldo_usd ?? 0);

    // 2. Verificar saldo de USD
    if (currentUsd < usdAmount) {
      throw new Error(`Saldo USD insuficiente. Tienes $${currentUsd.toFixed(2)} USD disponibles.`);
    }

    // 3. Calcular la cantidad de criptomoneda a recibir
    const cryptoToReceive = usdAmount / coinPrice;

    // 4. Calcular nuevos saldos
    const nuevoUsd = currentUsd - usdAmount;
    
    const updates: any = {
      saldo_usd: nuevoUsd,
      actualizado_en: new Date().toISOString()
    };

    if (crypto === 'btc') {
      updates.saldo_btc = Number(existingWallet.saldo_btc ?? 0) + cryptoToReceive;
    } else if (crypto === 'eth') {
      updates.saldo_eth = Number(existingWallet.saldo_eth ?? 0) + cryptoToReceive;
    } else if (crypto === 'sol') {
      updates.saldo_sol = Number(existingWallet.saldo_sol ?? 0) + cryptoToReceive;
    }

    // 5. Guardar en Supabase
    const { error: updateError } = await supabase
      .from('billeteras')
      .update(updates)
      .eq('usuario_id', userId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    // Registrar el movimiento de compra en la base de datos
    await supabase.from('movimientos').insert({
      usuario_id: userId,
      tipo: 'compra_directa',
      detalle: `Compra directa de ${crypto.toUpperCase()}`,
      monto_usd: usdAmount,
      moneda: crypto.toUpperCase(),
      cantidad_cripto: cryptoToReceive
    });

    return {
      success: true,
      message: `¡Compra exitosa! Has adquirido ${cryptoToReceive.toFixed(6)} ${crypto.toUpperCase()} por $${usdAmount.toFixed(2)} USD.`
    };
  } catch (err: unknown) {
    console.error('Error al comprar criptomoneda:', err);
    const msg = err instanceof Error ? err.message : 'Error al procesar la compra de criptomoneda.';
    return {
      success: false,
      message: msg
    };
  }
}

export interface Movimiento {
  id: string;
  usuario_id: string;
  tipo: string;
  detalle: string;
  monto_usd: number | null;
  moneda: string | null;
  cantidad_cripto: number | null;
  creado_a: string;
}

/**
 * Obtiene el historial de movimientos de la billetera del usuario.
 */
export async function getTransactionHistory(userId: string): Promise<{ success: boolean; message: string; data?: Movimiento[] }> {
  if (userId === 'guest-user-id') {
    return {
      success: true,
      message: 'Historial de transacciones obtenido con éxito.',
      data: [
        {
          id: 'mock-tx-1',
          usuario_id: 'guest-user-id',
          tipo: 'deposito',
          monto_usd: 10000.00,
          cantidad_cripto: 0,
          moneda: 'USD',
          detalle: 'Depósito Inicial de Invitado',
          creado_a: new Date(Date.now() - 86400000 * 2).toISOString()
        },
        {
          id: 'mock-tx-2',
          usuario_id: 'guest-user-id',
          tipo: 'compra_directa',
          monto_usd: 1500.00,
          cantidad_cripto: 0.024,
          moneda: 'BTC',
          detalle: 'Compra de BTC',
          creado_a: new Date(Date.now() - 86400000).toISOString()
        },
        {
          id: 'mock-tx-3',
          usuario_id: 'guest-user-id',
          tipo: 'transferencia_recibida',
          monto_usd: 2587.00,
          cantidad_cripto: 0,
          moneda: 'USD',
          detalle: 'Fondos Recibidos de Sistema',
          creado_a: new Date(Date.now() - 3600000 * 4).toISOString()
        }
      ]
    };
  }
  try {
    const { data, error } = await supabase
      .from('movimientos')
      .select('*')
      .eq('usuario_id', userId)
      .order('creado_a', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return {
      success: true,
      message: 'Historial de transacciones obtenido con éxito.',
      data: data as Movimiento[]
    };
  } catch (err: unknown) {
    console.error('Error al consultar movimientos:', err);
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Error al obtener historial de movimientos.'
    };
  }
}
