import { supabase } from './supabase';

/**
 * Inicia el flujo de autenticación con Google a través de Supabase OAuth.
 * Redirige al usuario al origen actual una vez completado el flujo.
 */
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      queryParams: {
        prompt: 'select_account',
      },
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Registra un nuevo usuario con correo electrónico, contraseña y metadatos adicionales en Supabase.
 */
export async function signUpWithEmail(email: string, pass: string, fullName?: string, avatarUrl?: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password: pass,
    options: {
      data: {
        full_name: fullName || 'Usuario',
        avatar_url: avatarUrl || '',
      }
    }
  });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Inicia sesión con correo electrónico y contraseña en Supabase.
 */
export async function signInWithEmail(email: string, pass: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: pass,
  });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Cierra la sesión activa del usuario en Supabase.
 */
export async function logout() {
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    throw error;
  }
}

/**
 * Consulta el rol del usuario en la tabla perfiles de Supabase.
 * Soporta de forma segura tanto la columna 'rol' como 'role' como fallback.
 */
export async function getUserRole(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('perfiles')
      .select('rol')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      // Si la columna 'rol' da error de base de datos (ej. no existe), intentamos con 'role'
      console.warn("Columna 'rol' no encontrada o inaccesible, intentando con 'role':", error.message);
      const { data: dataAlt, error: errorAlt } = await supabase
        .from('perfiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (errorAlt) {
        console.error("Error al consultar columna 'role' en perfiles:", errorAlt.message);
        return null;
      }
      return dataAlt ? (dataAlt as any).role : null;
    }

    return data ? (data as any).rol : null;
  } catch (err) {
    console.error('Excepción inesperada al obtener el rol del usuario:', err);
    return null;
  }
}
