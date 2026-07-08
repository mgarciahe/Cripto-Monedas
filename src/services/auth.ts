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
    },
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
