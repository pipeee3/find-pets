# 🐾 Find Pets — Guía de instalación

## Requisitos
- Node.js 18+
- MySQL 8+

---

## 1. Base de datos

Crea la base de datos en MySQL:

```sql
CREATE DATABASE find_pets CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Las tablas se crean automáticamente al arrancar el servidor.

---

## 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# Edita .env con tus credenciales de MySQL y cambia JWT_SECRET
node server.js
```

El servidor queda corriendo en **http://localhost:3000**

---

## 3. Frontend

Abre `frontend/src/index.html` con un servidor local.  
Recomendado: extensión **Live Server** en VS Code (clic derecho → "Open with Live Server").

> Si cambias el puerto del frontend, actualiza `FRONTEND_URL` en el `.env` del backend.

---

## Endpoints disponibles

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | /api/register | No | Registro |
| POST | /api/login | No | Login |
| GET | /api/perfil | Sí | Ver perfil |
| PUT | /api/perfil | Sí | Editar perfil |
| GET | /api/mascotas | No | Listar con filtros/paginación |
| GET | /api/mascotas/:id | No | Detalle de mascota |
| POST | /api/mascotas | Sí | Crear reporte |
| PUT | /api/mascotas/:id | Sí | Editar reporte |
| PUT | /api/mascotas/:id/resuelto | Sí | Marcar resuelto |
| DELETE | /api/mascotas/:id | Sí | Eliminar reporte |
| GET | /api/mis-mascotas | Sí | Mis reportes |

### Parámetros de GET /api/mascotas
- `estado` → perdido / encontrado / adopcion
- `tipo` → perro / gato / conejo / hamster / otro
- `resuelto` → true / false
- `buscar` → texto libre
- `pagina` → número de página (default: 1)
- `limite` → resultados por página (default: 12)
