# 🧪 Find Pets — Versión DEMO (sin servidor ni base de datos)

Copia del frontend que funciona **sin backend, sin MySQL y sin Railway**.
Login, registro, reportes, adopciones y perfil funcionan; todo se guarda en el
navegador (localStorage) mediante un "servidor falso" (`src/demo-api.js`).

La carpeta `frontend/` original **no se modificó**.

## Cómo abrirla
- **En tu computador:** abre la carpeta del proyecto en VS Code, clic derecho en
  `demo/src/index.html` → **Open with Live Server**.
- **En línea:** si tu GitHub Pages sirve este repositorio, la ruta sería
  `.../find-pets/demo/src/index.html`.

## Usuario de ejemplo
- Correo: `demo@findpets.com`
- Contraseña: `demo123`

También puedes crear tu propia cuenta en "Crear cuenta".

## Importante
- Los datos viven **solo en el navegador** donde los creas. Si presentas desde
  otro computador o borras los datos del navegador, empieza de cero con los
  datos de ejemplo.
- Para presentar: crea tus cuentas y reportes **en el mismo navegador** que vas
  a usar el jueves.
- Para reiniciar los datos: clic en la etiqueta azul "🧪 Versión demo" (abajo a
  la izquierda), o ejecuta `resetDemo()` en la consola del navegador.
- Las fotos se comprimen para caber en el navegador (límite total ~5 MB).
- Las contraseñas **no están protegidas de forma real**: esto es solo una demo,
  no usarla en producción.
- Necesita internet para cargar Tailwind y Flowbite desde sus CDN.
