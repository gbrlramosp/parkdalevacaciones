# Administrador de Vacaciones

Aplicacion estatica preparada para Vercel y Supabase.

## Configurar Supabase

1. Crea un proyecto en Supabase.
2. Ejecuta `supabase/schema.sql` desde el SQL Editor.
3. En Authentication > Users crea los usuarios permitidos.
4. Usa correos completos al iniciar sesion o crea usuarios con el dominio configurado, por ejemplo `isaifonseca@parkdale.local`.

## Configurar Vercel

Importa esta carpeta como proyecto y agrega estas variables de entorno:

```text
SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_ANON_KEY=TU_ANON_KEY
SUPABASE_AUTH_EMAIL_DOMAIN=parkdale.local
```

La ruta `/api/config` expone solamente la URL y la clave anonima publica requeridas por el cliente web. No agregues una `service_role` key.

En Vercel selecciona los entornos `Production`, `Preview` y `Development` al crear las variables. Despues ejecuta un nuevo deploy: los deployments existentes no reciben variables agregadas posteriormente.

Puedes comprobar la configuracion abriendo `https://TU-DOMINIO.vercel.app/api/config`. Debe responder:

```json
{"configured":true,"missing":[]}
```

En la configuracion del proyecto de Vercel usa esta carpeta como `Root Directory`. No selecciones `Documents` ni una carpeta superior que no contenga `index.html`. No se requiere comando de build: Vercel sirve `index.html` directamente.

## Desarrollo local

Para probar con Supabase desde XAMPP, completa temporalmente `supabase-config.js`:

```js
window.PARKDALE_SUPABASE_CONFIG = {
  supabaseUrl: 'https://TU-PROYECTO.supabase.co',
  supabaseAnonKey: 'TU_ANON_KEY',
  authEmailDomain: 'parkdale.local'
};
```

Si esos valores se dejan vacios, `localhost` conserva el modo local de respaldo. El usuario local de desarrollo es `isaifonseca` con la contraseña existente del prototipo. Ese acceso local queda deshabilitado fuera de `localhost`.

## Archivos principales

- `index.html`: entrada para Vercel.
- `parkdale-vacaciones_v2.html`: version editable de la aplicacion.
- `supabase-app.js`: autenticacion, sesion y persistencia.
- `supabase/schema.sql`: tablas, politicas RLS y folios.
- `api/config.js`: configuracion publica para Vercel.
