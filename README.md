# BPM Control de Incumplimientos

Aplicación SaaS para gestionar colaboradores, incumplimientos BPM, reincidencias, descargos, plazos, reportes y notificaciones.

> Nota: la trazabilidad de cambios (`audit_log`) se sigue registrando automáticamente en la base de datos vía triggers, pero ya no tiene una página en el menú.

## Stack
React + Vite + TailwindCSS + React Router + React Hook Form + SheetJS + Recharts + Heroicons + Supabase/PostgreSQL + jsPDF.

## Ejecutar localmente
```bash
npm install
cp .env.example .env
# en Windows PowerShell: Copy-Item .env.example .env
npm run dev
```

Variables:
`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

En ausencia de Supabase configurado, la aplicación funciona en **modo demo local** usando localStorage con credenciales de demostración.

## Supabase
1. Cree el proyecto.
2. Ejecute `supabase/schema.sql` completo desde SQL Editor.
3. Cree usuarios desde Authentication > Users.
4. Después de crear el primer usuario, actualice su rol en `public.profiles` a `administrador`. Ejemplo:
```sql
update public.profiles set rol='administrador' where correo='tu-correo@empresa.co';
```
5. Los demás usuarios pueden quedar como `supervisor_bpm`, `coordinador` o `consulta`.
6. El bucket privado `descargos` se crea por el SQL.
7. Para notificaciones temporizadas, programe `select public.procesar_notificaciones();` con Supabase Cron/pg_cron una vez al día.

### Reglas PostgreSQL
La reincidencia y la creación automática del descargo de tercera reincidencia están implementadas con triggers. La configuración del plazo reside en `public.configuracion` y la matriz de niveles en `public.reglas_reincidencia`.

## Netlify
`netlify.toml` ya incluye build y SPA redirect.
- Build command: `npm run build`
- Publish: `dist`
- Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

No coloque la `service_role` key en el cliente.

## Excel
La importación de colaboradores busca exactamente la hoja `LISTADO PERSONAL`. Reconoce variantes de encabezado para cédula, nombre, cargo, área y tipo de vinculación. Usa la cédula como clave de upsert para actualizar duplicados y muestra importados, actualizados y errores.

## PDF de descargos
Desde el módulo de Gestión de descargos se puede adjuntar el PDF firmado al bucket privado `descargos`, generando URLs firmadas para su consulta. El esquema contempla `pdf_url` en la tabla `descargos`.

## Producción
Activar MFA, configurar SMTP para recuperación de contraseña, revisar dominios/redirect URLs de Supabase Auth, backups/PITR y políticas de Storage. El frontend aplica protección de rutas, pero la seguridad efectiva está en RLS.
