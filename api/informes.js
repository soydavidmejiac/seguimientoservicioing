import { neon } from '@neondatabase/serverless';

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL;
const PIN = process.env.REPORTES_PIN || '';

let ready = false;
async function ensureTable(sql) {
  if (ready) return;
  await sql`CREATE TABLE IF NOT EXISTS informes (
    id            BIGSERIAL PRIMARY KEY,
    client_id     TEXT UNIQUE NOT NULL,
    fecha         DATE NOT NULL,
    director      TEXT NOT NULL,
    eficiencia    INT,
    a_tiempo      INT,
    tarde         INT,
    na            INT,
    atraso_min    INT,
    asistencia_total INT,
    asistencia    JSONB,
    tareas        JSONB,
    observacion   TEXT,
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS informes_fecha_idx ON informes (fecha)`;
  ready = true;
}

const int = v => (Number.isFinite(+v) ? Math.max(0, Math.round(+v)) : 0);
const txt = (v, max = 4000) => String(v ?? '').slice(0, max);
const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!DB_URL) return res.status(503).json({ error: 'Base de datos no conectada' });
  const sql = neon(DB_URL);

  try {
    await ensureTable(sql);

    if (req.method === 'POST') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      if (!b.client_id || !isDate(b.fecha) || !txt(b.director).trim())
        return res.status(400).json({ error: 'Datos incompletos' });
      const asistencia = JSON.stringify(b.asistencia || {});
      const tareas = JSON.stringify(Array.isArray(b.tareas) ? b.tareas.slice(0, 200) : []);
      const rows = await sql`
        INSERT INTO informes (client_id, fecha, director, eficiencia, a_tiempo, tarde, na, atraso_min,
                              asistencia_total, asistencia, tareas, observacion)
        VALUES (${txt(b.client_id, 80)}, ${b.fecha}, ${txt(b.director, 200)}, ${int(b.eficiencia)}, ${int(b.a_tiempo)},
                ${int(b.tarde)}, ${int(b.na)}, ${int(b.atraso_min)}, ${int(b.asistencia_total)},
                ${asistencia}::jsonb, ${tareas}::jsonb, ${txt(b.observacion)})
        ON CONFLICT (client_id) DO UPDATE SET
          fecha = EXCLUDED.fecha, director = EXCLUDED.director, eficiencia = EXCLUDED.eficiencia,
          a_tiempo = EXCLUDED.a_tiempo, tarde = EXCLUDED.tarde, na = EXCLUDED.na,
          atraso_min = EXCLUDED.atraso_min, asistencia_total = EXCLUDED.asistencia_total,
          asistencia = EXCLUDED.asistencia, tareas = EXCLUDED.tareas,
          observacion = EXCLUDED.observacion, updated_at = now()
        RETURNING id`;
      return res.status(200).json({ ok: true, id: rows[0].id });
    }

    if (req.method === 'GET') {
      const pin = req.headers['x-pin'] || '';
      if (!PIN || pin !== PIN) return res.status(401).json({ error: 'PIN incorrecto' });
      const desde = isDate(req.query.desde) ? req.query.desde : '1900-01-01';
      const hasta = isDate(req.query.hasta) ? req.query.hasta : '2999-12-31';
      const rows = await sql`
        SELECT id, client_id, to_char(fecha,'YYYY-MM-DD') AS fecha, director, eficiencia, a_tiempo, tarde, na,
               atraso_min, asistencia_total, asistencia, tareas, observacion, created_at
        FROM informes WHERE fecha BETWEEN ${desde} AND ${hasta}
        ORDER BY fecha DESC, created_at DESC`;
      return res.status(200).json({ ok: true, informes: rows });
    }

    if (req.method === 'DELETE') {
      const pin = req.headers['x-pin'] || '';
      if (!PIN || pin !== PIN) return res.status(401).json({ error: 'PIN incorrecto' });
      const id = int(req.query.id);
      await sql`DELETE FROM informes WHERE id = ${id}`;
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Método no permitido' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error del servidor' });
  }
}
