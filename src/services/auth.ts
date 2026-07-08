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
        full_name: fullName || 'Usuario AetherWallet',
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
