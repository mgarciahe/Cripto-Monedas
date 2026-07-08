const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Leer variables de entorno desde .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

const getEnvVar = (name) => {
  const match = envContent.match(new RegExp(`${name}\\s*=\\s*([^\\n\\r]+)`));
  return match ? match[1].trim().replace(/['"]/g, '') : null;
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: No se encontraron las credenciales en .env.local');
  process.exit(1);
}

// 2. Inicializar cliente y consultar tabla
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  try {
    // Intentamos seleccionar una sola fila
    const { data, error } = await supabase
      .from('ofertas_p2p')
      .select('*')
      .limit(1);

    if (error) {
      console.error('Error de Supabase:', error.message);
      process.exit(1);
    }

    if (data && data.length > 0) {
      console.log('Columnas encontradas en ofertas_p2p:', Object.keys(data[0]));
    } else {
      // Intentar una consulta vacía para obtener el tipo/campos de la tabla
      const { data: colsData, error: colsError } = await supabase
        .from('ofertas_p2p')
        .select();
      
      if (colsError) {
        console.error('Error al consultar columnas vacías:', colsError.message);
      } else {
        console.log('Metadatos de columnas en tabla vacía:', colsData);
      }
    }
  } catch (err) {
    console.error('Error de script:', err.message);
  }
}

checkColumns();
