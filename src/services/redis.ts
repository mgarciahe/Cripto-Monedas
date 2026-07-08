import { Redis } from '@upstash/redis';

// Leer de forma segura las variables de entorno utilizando la sintaxis de Vite (import.meta.env)
// Nota: En Vite, las variables expuestas al navegador deben tener el prefijo VITE_
const redisUrl = import.meta.env.VITE_REDIS_URL || import.meta.env.REDIS_URL;
const redisToken = import.meta.env.VITE_REDIS_TOKEN || import.meta.env.REDIS_TOKEN;

// Validación de seguridad para verificar la existencia de las variables de entorno
if (!redisUrl || !redisToken) {
  console.warn(
    'CRÍTICO: No se han configurado las variables de entorno VITE_REDIS_URL o VITE_REDIS_TOKEN. ' +
    'La capa de caché de Redis no funcionará correctamente en este entorno.'
  );
}

/**
 * Instancia inicializada del cliente de Upstash Redis listo para
 * realizar operaciones CRUD de clave-valor (como GET y SET) con tipado fuerte.
 */
export const redis = new Redis({
  url: redisUrl || '',
  token: redisToken || '',
});
