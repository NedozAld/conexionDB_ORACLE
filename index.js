const express = require('express');
const path = require('path');
const { Sequelize, QueryTypes } = require('sequelize');
const app = express();
const port = process.env.PORT || 3000;

// Credenciales por defecto
const DEFAULT_USER = 'hr';
const DEFAULT_PASSWORD = 'hr';

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Estilos globales y Bootstrap
const bootstrapLink = `<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous">`;

const estilosGlobales = `<style>
  body { background: radial-gradient(circle at 20% 20%, rgba(255,255,255,0.08), transparent 25%), radial-gradient(circle at 80% 0%, rgba(255,255,255,0.12), transparent 30%), linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
  .glass-card { background: rgba(255,255,255,0.93); border-radius: 16px; box-shadow: 0 12px 35px rgba(0,0,0,0.18); backdrop-filter: blur(6px); border: 1px solid rgba(255,255,255,0.35); }
  .section-title { color: #0f172a; font-weight: 700; letter-spacing: 0.5px; }
  .hero-text { text-shadow: 0 6px 18px rgba(0,0,0,0.25); }
  .prime-pill { display: inline-flex; align-items: center; justify-content: center; padding: 0.65rem 0.9rem; border-radius: 12px; font-weight: 700; color: #0b3b2c; background: linear-gradient(135deg, #c8f7dc, #8de4b1); box-shadow: inset 0 1px 0 rgba(255,255,255,0.6), 0 4px 10px rgba(0,0,0,0.08); }
  .stat-card { border: none; background: linear-gradient(135deg, #4f46e5, #8b5cf6); color: #fff; box-shadow: 0 12px 30px rgba(79,70,229,0.35); }
  .stat-card .card-title { text-transform: uppercase; letter-spacing: 0.8px; font-size: 0.85rem; opacity: 0.9; }
  .stat-card .display-6 { font-weight: 700; }
  .table thead th { background: #111827; color: #f9fafb; border: none; }
  .table tbody tr:hover { background: rgba(17,24,39,0.04); }
  .pagination .page-link { border: none; color: #4f46e5; font-weight: 600; }
  .pagination .active > .page-link { background: #4f46e5; color: #fff; box-shadow: 0 10px 25px rgba(79,70,229,0.35); }
  .btn-ghost { border: 1px solid rgba(255,255,255,0.6); color: #fff; background: rgba(255,255,255,0.1); }
  .btn-ghost:hover { background: rgba(255,255,255,0.2); color: #fff; }
  .badge-soft { background: rgba(255,255,255,0.18); color: #fff; border: 1px solid rgba(255,255,255,0.4); }
  .muted { color: #64748b; }
</style>`;

// Ruta para mostrar el formulario
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'numeros-primos.html'));
});

// Ruta para ver resultados con paginación (GET)
app.get('/primos', async (req, res) => {
  const page = parseInt(req.query.page || '1', 10) || 1;
  const limit = 20; // 20 registros por página
  const offset = (page - 1) * limit;

  const sequelize = new Sequelize('XE', DEFAULT_USER, DEFAULT_PASSWORD, {
    host: 'localhost',
    dialect: 'oracle',
    port: 1521,
    dialectOptions: {
      connectString: 'localhost/XE'
    },
    logging: false
  });

  try {
    await sequelize.authenticate();

    const totalPrimos = await sequelize.query(
      `SELECT COUNT(*) AS TOTAL FROM (SELECT NUMERO_PRIMO FROM NUMEROS_PRIMOS GROUP BY NUMERO_PRIMO)`,
      { type: QueryTypes.SELECT }
    );
    const total = totalPrimos[0]?.TOTAL || 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    // Construir arreglo de páginas con elipsis para navegación rápida
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('ellipsis-left');
      const windowStart = Math.max(2, page - 1);
      const windowEnd = Math.min(totalPages - 1, page + 1);
      for (let i = windowStart; i <= windowEnd; i++) pages.push(i);
      if (page < totalPages - 2) pages.push('ellipsis-right');
      pages.push(totalPages);
    }

    const primos = await sequelize.query(
      `WITH base AS (
           SELECT NUMERO_PRIMO, FECHA_GENERACION, USUARIO_GENERADOR,
                  ROW_NUMBER() OVER (PARTITION BY NUMERO_PRIMO ORDER BY FECHA_GENERACION DESC) rn_dup
           FROM NUMEROS_PRIMOS
         ),
         dedup AS (
           SELECT NUMERO_PRIMO, FECHA_GENERACION, USUARIO_GENERADOR
           FROM base WHERE rn_dup = 1
         ),
         ordered AS (
           SELECT NUMERO_PRIMO, FECHA_GENERACION, USUARIO_GENERADOR,
                  ROW_NUMBER() OVER (ORDER BY NUMERO_PRIMO ASC) rn_row
           FROM dedup
         )
       SELECT NUMERO_PRIMO, FECHA_GENERACION, USUARIO_GENERADOR
       FROM ordered
       WHERE rn_row > :offset AND rn_row <= :offset_plus
       ORDER BY NUMERO_PRIMO ASC`,
      {
        type: QueryTypes.SELECT,
        replacements: { offset, offset_plus: offset + limit }
      }
    );

    let html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Números Primos</title>
  ${bootstrapLink}
  ${estilosGlobales}
</head>
<body>
  <div class="container py-4">
    <div class="text-center text-white mb-4">
      <span class="badge badge-soft px-3 py-2">🔐 Sesión HR</span>
      <h1 class="fw-bold hero-text mt-2">📋 Lista de Números Primos</h1>
      <p class="mb-0 opacity-75">Consulta paginada y ordenada de los primos generados</p>
    </div>

    <div class="row g-3 mb-4">
      <div class="col-md-4">
        <div class="card stat-card h-100">
          <div class="card-body text-center">
            <div class="card-title mb-1">Total almacenados</div>
            <div class="display-6">${total}</div>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card stat-card h-100">
          <div class="card-body text-center">
            <div class="card-title mb-1">Usuario</div>
            <div class="display-6">${DEFAULT_USER.toUpperCase()}</div>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card stat-card h-100">
          <div class="card-body text-center">
            <div class="card-title mb-1">Primer primo listado</div>
            <div class="display-6">${primos.length > 0 ? primos[0].NUMERO_PRIMO : 'N/A'}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card glass-card border-0 mb-4">
      <div class="card-header bg-white border-0 d-flex justify-content-between align-items-center">
        <h2 class="h5 section-title mb-0">Vista en grilla</h2>
        <span class="badge text-bg-primary">${primos.length} en página</span>
      </div>
      <div class="card-body">
        <div class="d-flex flex-wrap gap-2">`;

    primos.forEach(primo => {
      html += `<span class="prime-pill">${primo.NUMERO_PRIMO}</span>`;
    });

    html += `</div>
      </div>
    </div>

    <div class="card glass-card border-0 mb-4">
      <div class="card-header bg-white border-0 d-flex justify-content-between align-items-center">
        <h2 class="h5 section-title mb-0">Tabla detallada</h2>
        <span class="muted">Página ${page} de ${totalPages}</span>
      </div>
      <div class="card-body">
        <div class="table-responsive">
          <table class="table align-middle mb-0">
            <thead>
              <tr>
                <th>🔢 Número Primo</th>
                <th>📅 Fecha de Generación</th>
                <th>👤 Usuario</th>
              </tr>
            </thead>
            <tbody>`;

    primos.forEach(primo => {
      const fecha = new Date(primo.FECHA_GENERACION).toLocaleString('es-MX');
      html += `<tr>
        <td class="fw-semibold">${primo.NUMERO_PRIMO}</td>
        <td>${fecha}</td>
        <td>${primo.USUARIO_GENERADOR}</td>
      </tr>`;
    });

    html += `</tbody>
          </table>
        </div>
      </div>
    </div>

    <nav aria-label="Paginación" class="mb-4">
      <ul class="pagination justify-content-center gap-1 flex-wrap">
        <li class="page-item ${page <= 1 ? 'disabled' : ''}">
          <a class="page-link" href="/primos?page=${page-1}">Anterior</a>
        </li>
        ${pages.map(p => {
          if (p === 'ellipsis-left' || p === 'ellipsis-right') {
            return `<li class="page-item disabled"><span class="page-link">…</span></li>`;
          }
          return `<li class="page-item ${p === page ? 'active' : ''}"><a class="page-link" href="/primos?page=${p}">${p}</a></li>`;
        }).join('')}
        <li class="page-item ${page >= totalPages ? 'disabled' : ''}">
          <a class="page-link" href="/primos?page=${page+1}">Siguiente</a>
        </li>
      </ul>
    </nav>

    <div class="d-flex justify-content-center">
      <a href="/" class="btn btn-light px-4 shadow-sm">🔄 Generar más primos</a>
    </div>
  </div>
</body>
</html>`;

    res.send(html);
  } catch (error) {
    const errorMsg = error.message;
    res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Error</title>
  ${bootstrapLink}
  ${estilosGlobales}
</head>
<body>
  <div class="container py-5">
    <div class="card glass-card border-0 mx-auto" style="max-width: 720px;">
      <div class="card-body text-center">
        <div class="mb-3"><span class="badge text-bg-danger px-3 py-2">Error</span></div>
        <h1 class="fw-bold mb-3">❌ No se pudo procesar</h1>
        <p class="lead">${errorMsg.includes('ORA-00942') ? 
          '⚠️ La tabla NUMEROS_PRIMOS no existe. Por favor ejecuta el script SQL primero.' : 
          errorMsg.includes('ORA-01017') ?
          '🔒 Error de autenticación.' :
          '❌ Error: ' + errorMsg
        }</p>
        <a href="/" class="btn btn-dark mt-3">🔙 Volver</a>
      </div>
    </div>
  </div>
</body>
</html>`);
  } finally {
    await sequelize.close();
  }
});

// Ruta para generar números primos
app.post('/generar-primos', async (req, res) => {
  const { cantidad } = req.body;
  
  // Validar cantidad
  if (!cantidad || cantidad < 1 || cantidad > 1000) {
    return res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Error</title>
  ${bootstrapLink}
  ${estilosGlobales}
</head>
<body>
  <div class="container py-5">
    <div class="card glass-card border-0 mx-auto" style="max-width: 720px;">
      <div class="card-body text-center">
        <div class="mb-3"><span class="badge text-bg-danger px-3 py-2">Dato inválido</span></div>
        <h1 class="fw-bold mb-3">❌ La cantidad debe ser entre 1 y 1000</h1>
        <a href="/" class="btn btn-dark mt-2">🔙 Volver</a>
      </div>
    </div>
  </div>
</body>
</html>`);
  }

  const sequelize = new Sequelize('XE', DEFAULT_USER, DEFAULT_PASSWORD, {
    host: 'localhost',
    dialect: 'oracle',
    port: 1521,
    dialectOptions: {
      connectString: 'localhost/XE'
    },
    logging: false
  });

  try {
    await sequelize.authenticate();
    
    // Calcular cuántos faltan para llegar al total solicitado (sin duplicados)
    const existentes = await sequelize.query(
      `SELECT COUNT(DISTINCT NUMERO_PRIMO) AS TOTAL FROM NUMEROS_PRIMOS`,
      { type: QueryTypes.SELECT }
    );
    const actuales = existentes[0]?.TOTAL || 0;
    const faltan = Math.max(0, parseInt(cantidad) - actuales);

    if (faltan > 0) {
      await sequelize.query(
        `BEGIN SP_GENERAR_NUMEROS_PRIMOS(:cantidad, :usuario); END;`,
        {
          replacements: { cantidad: faltan, usuario: DEFAULT_USER.toUpperCase() }
        }
      );
    }

    // Redirigir a la página de resultados con paginación
    res.redirect('/primos?page=1');
  } catch (error) {
    const errorMsg = error.message;
    res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Error</title>
  ${bootstrapLink}
  ${estilosGlobales}
</head>
<body>
  <div class="container py-5">
    <div class="card glass-card border-0 mx-auto" style="max-width: 780px;">
      <div class="card-body text-center">
        <div class="mb-3"><span class="badge text-bg-danger px-3 py-2">Error</span></div>
        <h1 class="fw-bold mb-3">❌ No se pudieron generar los números</h1>
        <p class="lead">${errorMsg.includes('ORA-00942') ? 
          '⚠️ La tabla NUMEROS_PRIMOS no existe. Por favor ejecuta el script SQL primero.' : 
          errorMsg.includes('ORA-00955') ? 
          '⚠️ El procedimiento SP_GENERAR_NUMEROS_PRIMOS no existe. Por favor ejecuta el script SQL primero.' :
          errorMsg.includes('ORA-01017') ?
          '🔒 Usuario o contraseña incorrectos.' :
          '❌ Error: ' + errorMsg
        }</p>
        <a href="/" class="btn btn-dark mt-3">🔙 Volver</a>
      </div>
    </div>
  </div>
</body>
</html>`);
  } finally {
    await sequelize.close();
  }
});

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});

console.log('Servidor iniciado, esperando conexiones...');
console.log('Presiona Ctrl+C para salir...');
