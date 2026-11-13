# Seguimiento de Servicio · ING

Informe de servicio de la Iglesia Nueva Generación.

- `/` — formulario del Director de Culto (guarda en la base de datos y envía resumen por WhatsApp)
- `/reportes` — panel de reportes protegido con PIN (fecha, mes, cuatrimestre, semestre, año o personalizado)
- `/api/informes` — API (Vercel Function) sobre Postgres (Neon)

Variables de entorno en Vercel:
- `DATABASE_URL` — la crea la integración de Neon
- `REPORTES_PIN` — PIN del panel de reportes
