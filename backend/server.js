if (process.env.NODE_ENV !== 'production') require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

// ─── Configuración ───────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const MAX_FILE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '5');

if (!JWT_SECRET) {
    console.error('❌ ERROR: JWT_SECRET no está definido en .env');
    process.exit(1);
}

// ─── Directorio de uploads ───────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// ─── Multer con validación ───────────────────────────────────────────────────
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({
    storage,
    limits: { fileSize: MAX_FILE_MB * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (ALLOWED_MIME.includes(file.mimetype)) return cb(null, true);
        cb(new Error('Solo se permiten imágenes (jpg, png, webp, gif)'));
    }
});

// ─── Express ─────────────────────────────────────────────────────────────────
const app = express();

app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

// ─── Rate limiting ────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Demasiados intentos. Espera 15 minutos.' }
});
const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: { error: 'Demasiadas solicitudes. Intenta más tarde.' }
});
app.use(generalLimiter);

// ─── Base de datos ────────────────────────────────────────────────────────────
const db = mysql.createConnection({
    host: process.env.DATABASE_HOST || 'localhost',
    user: process.env.DATABASE_USER || 'root',
    password: process.env.DATABASE_PASSWORD || '',
    database: process.env.DATABASE_NAME || 'find_pets',
    port: process.env.DATABASE_PORT || 3306
});

db.connect((err) => {
    if (err) { console.error('❌ Error conectando a MySQL:', err.message); return; }
    console.log('✅ Conectado a MySQL');
    inicializarTablas();
});

function inicializarTablas() {
    db.query(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id INT AUTO_INCREMENT PRIMARY KEY,
            nombre VARCHAR(100) NOT NULL,
            email VARCHAR(150) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            telefono VARCHAR(20),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    db.query(`
        CREATE TABLE IF NOT EXISTS mascotas (
            id INT AUTO_INCREMENT PRIMARY KEY,
            nombre VARCHAR(100),
            tipo VARCHAR(50) NOT NULL,
            raza VARCHAR(100),
            descripcion TEXT NOT NULL,
            ubicacion VARCHAR(255) NOT NULL,
            estado ENUM('perdido','encontrado','adopcion') NOT NULL DEFAULT 'perdido',
            resuelto TINYINT(1) DEFAULT 0,
            contacto VARCHAR(150),
            foto VARCHAR(255),
            usuario_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
        )
    `);
    console.log('✅ Tablas verificadas/creadas');
}

// ─── Middleware auth ──────────────────────────────────────────────────────────
function verificarToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No autorizado' });
    try {
        req.userId = jwt.verify(token, JWT_SECRET).id;
        next();
    } catch {
        return res.status(401).json({ error: 'Token inválido o expirado' });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// RUTAS AUTH
// ─────────────────────────────────────────────────────────────────────────────

// REGISTRO
app.post('/api/register', authLimiter, async (req, res) => {
    const { nombre, email, password, telefono } = req.body;
    if (!nombre || !email || !password)
        return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios' });
    if (password.length < 6)
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

    try {
        const hashedPassword = await bcrypt.hash(password, 12);
        db.query(
            'INSERT INTO usuarios (nombre, email, password, telefono) VALUES (?, ?, ?, ?)',
            [nombre.trim(), email.trim().toLowerCase(), hashedPassword, telefono || null],
            (err) => {
                if (err) return res.status(400).json({ error: 'El email ya está registrado' });
                res.json({ message: 'Usuario registrado correctamente' });
            }
        );
    } catch {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// LOGIN
app.post('/api/login', authLimiter, (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
        return res.status(400).json({ error: 'Email y contraseña son obligatorios' });

    db.query('SELECT * FROM usuarios WHERE email = ?', [email.trim().toLowerCase()], async (err, results) => {
        if (err || results.length === 0)
            return res.status(400).json({ error: 'Credenciales incorrectas' });
        const user = results[0];
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(400).json({ error: 'Credenciales incorrectas' });
        const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, nombre: user.nombre, id: user.id });
    });
});

// PERFIL DEL USUARIO ACTUAL
app.get('/api/perfil', verificarToken, (req, res) => {
    db.query('SELECT id, nombre, email, telefono, created_at FROM usuarios WHERE id = ?',
        [req.userId], (err, results) => {
            if (err || results.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
            res.json(results[0]);
        }
    );
});

// ACTUALIZAR PERFIL
app.put('/api/perfil', verificarToken, async (req, res) => {
    const { nombre, telefono, password } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });

    let query, params;
    if (password && password.length >= 6) {
        const hashed = await bcrypt.hash(password, 12);
        query = 'UPDATE usuarios SET nombre=?, telefono=?, password=? WHERE id=?';
        params = [nombre.trim(), telefono || null, hashed, req.userId];
    } else {
        query = 'UPDATE usuarios SET nombre=?, telefono=? WHERE id=?';
        params = [nombre.trim(), telefono || null, req.userId];
    }
    db.query(query, params, (err) => {
        if (err) return res.status(500).json({ error: 'Error actualizando perfil' });
        res.json({ message: 'Perfil actualizado' });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// RUTAS MASCOTAS
// ─────────────────────────────────────────────────────────────────────────────

// CREAR MASCOTA
app.post('/api/mascotas', verificarToken, upload.single('foto'), (req, res) => {
    const { nombre, tipo, raza, descripcion, ubicacion, estado, contacto } = req.body;
    if (!tipo || !descripcion || !ubicacion)
        return res.status(400).json({ error: 'Tipo, descripción y ubicación son obligatorios' });

    const foto = req.file ? req.file.filename : null;
    db.query(
        'INSERT INTO mascotas (nombre, tipo, raza, descripcion, ubicacion, estado, contacto, usuario_id, foto) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [nombre || null, tipo, raza || null, descripcion, ubicacion, estado || 'perdido', contacto || null, req.userId, foto],
        (err, result) => {
            if (err) return res.status(500).json({ error: 'Error al guardar' });
            res.json({ message: 'Reporte guardado', id: result.insertId });
        }
    );
});

// LISTAR MASCOTAS con filtros y paginación
app.get('/api/mascotas', (req, res) => {
    const { estado, tipo, resuelto, buscar, pagina = 1, limite = 12 } = req.query;
    const offset = (parseInt(pagina) - 1) * parseInt(limite);

    let where = [];
    let params = [];

    if (estado) { where.push('m.estado = ?'); params.push(estado); }
    if (tipo) { where.push('m.tipo = ?'); params.push(tipo); }
    if (resuelto !== undefined) { where.push('m.resuelto = ?'); params.push(resuelto === 'true' ? 1 : 0); }
    if (buscar) {
        where.push('(m.nombre LIKE ? OR m.descripcion LIKE ? OR m.ubicacion LIKE ? OR m.raza LIKE ?)');
        const term = `%${buscar}%`;
        params.push(term, term, term, term);
    }

    const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : '';

    db.query(
        `SELECT COUNT(*) as total FROM mascotas m ${whereStr}`,
        params,
        (err, countResult) => {
            if (err) return res.status(500).json({ error: 'Error al contar' });
            const total = countResult[0].total;

            db.query(
                `SELECT m.*, u.nombre as dueno, u.telefono as dueno_telefono
                 FROM mascotas m
                 JOIN usuarios u ON m.usuario_id = u.id
                 ${whereStr}
                 ORDER BY m.created_at DESC
                 LIMIT ? OFFSET ?`,
                [...params, parseInt(limite), offset],
                (err, results) => {
                    if (err) return res.status(500).json({ error: 'Error al obtener' });
                    res.json({
                        mascotas: results,
                        total,
                        pagina: parseInt(pagina),
                        totalPaginas: Math.ceil(total / parseInt(limite))
                    });
                }
            );
        }
    );
});

// ÚLTIMAS MASCOTAS (debe ir antes de /:id para que Express no lo confunda)
app.get('/api/mascotas/ultimas', (req, res) => {
    const sql = `
        SELECT m.*, u.nombre as dueno
        FROM mascotas m
        JOIN usuarios u ON m.usuario_id = u.id
        WHERE m.resuelto = 0
        ORDER BY m.created_at DESC
        LIMIT 6
    `;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: 'Error obteniendo mascotas' });
        res.json(results);
    });
});


// DETALLE DE UNA MASCOTA
app.get('/api/mascotas/:id', (req, res) => {
    db.query(
        `SELECT m.*, u.nombre as dueno, u.email as dueno_email, u.telefono as dueno_telefono
         FROM mascotas m JOIN usuarios u ON m.usuario_id = u.id
         WHERE m.id = ?`,
        [req.params.id],
        (err, results) => {
            if (err) return res.status(500).json({ error: 'Error al obtener' });
            if (results.length === 0) return res.status(404).json({ error: 'Mascota no encontrada' });
            res.json(results[0]);
        }
    );
});

// EDITAR MASCOTA
app.put('/api/mascotas/:id', verificarToken, upload.single('foto'), (req, res) => {
    const { nombre, tipo, raza, descripcion, ubicacion, estado, contacto } = req.body;
    if (!tipo || !descripcion || !ubicacion)
        return res.status(400).json({ error: 'Tipo, descripción y ubicación son obligatorios' });

    // Verificar que es dueño
    db.query('SELECT * FROM mascotas WHERE id = ? AND usuario_id = ?', [req.params.id, req.userId], (err, results) => {
        if (err || results.length === 0) return res.status(403).json({ error: 'No autorizado' });

        const fotoActual = results[0].foto;
        const fotoNueva = req.file ? req.file.filename : fotoActual;

        // Si hay nueva foto, borrar la anterior
        if (req.file && fotoActual) {
            const fotoPath = path.join(uploadsDir, fotoActual);
            if (fs.existsSync(fotoPath)) fs.unlinkSync(fotoPath);
        }

        db.query(
            'UPDATE mascotas SET nombre=?, tipo=?, raza=?, descripcion=?, ubicacion=?, estado=?, contacto=?, foto=? WHERE id=? AND usuario_id=?',
            [nombre || null, tipo, raza || null, descripcion, ubicacion, estado, contacto || null, fotoNueva, req.params.id, req.userId],
            (err) => {
                if (err) return res.status(500).json({ error: 'Error al actualizar' });
                res.json({ message: 'Reporte actualizado' });
            }
        );
    });
});

// MARCAR COMO RESUELTO
app.put('/api/mascotas/:id/resuelto', verificarToken, (req, res) => {
    db.query(
        'UPDATE mascotas SET resuelto = 1 WHERE id = ? AND usuario_id = ?',
        [req.params.id, req.userId],
        (err, result) => {
            if (err) return res.status(500).json({ error: 'Error al actualizar' });
            if (result.affectedRows === 0) return res.status(403).json({ error: 'No autorizado' });
            res.json({ message: 'Marcado como resuelto' });
        }
    );
});

// ELIMINAR MASCOTA
app.delete('/api/mascotas/:id', verificarToken, (req, res) => {
    db.query('SELECT foto FROM mascotas WHERE id = ? AND usuario_id = ?', [req.params.id, req.userId], (err, results) => {
        if (err || results.length === 0) return res.status(403).json({ error: 'No autorizado' });

        const foto = results[0].foto;
        db.query('DELETE FROM mascotas WHERE id = ? AND usuario_id = ?', [req.params.id, req.userId], (err) => {
            if (err) return res.status(500).json({ error: 'Error al eliminar' });
            if (foto) {
                const fotoPath = path.join(uploadsDir, foto);
                if (fs.existsSync(fotoPath)) fs.unlinkSync(fotoPath);
            }
            res.json({ message: 'Eliminado correctamente' });
        });
    });
});

// MIS MASCOTAS
app.get('/api/mis-mascotas', verificarToken, (req, res) => {
    db.query(
        'SELECT * FROM mascotas WHERE usuario_id = ? ORDER BY created_at DESC',
        [req.userId],
        (err, results) => {
            if (err) return res.status(500).json({ error: 'Error al obtener' });
            res.json(results);
        }
    );
});

// ─── Error handler multer ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    if (err.code === 'LIMIT_FILE_SIZE')
        return res.status(400).json({ error: `La imagen no puede superar ${MAX_FILE_MB}MB` });
    if (err.message && err.message.includes('Solo se permiten imágenes'))
        return res.status(400).json({ error: err.message });
    next(err);
});

// ─── Estadísticas ────────────────────────────────────────────────────────────
app.get('/api/estadisticas', (req, res) => {
    const sql = `
        SELECT
            COUNT(*) as total,
            SUM(estado = 'perdido' AND resuelto = 0) as perdidos,
            SUM(estado = 'encontrado' AND resuelto = 0) as encontrados,
            SUM(estado = 'adopcion' AND resuelto = 0) as adopcion,
            SUM(resuelto = 1) as resueltos
        FROM mascotas
    `;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: 'Error obteniendo estadísticas' });
        res.json(results[0]);
    });
});

// ─── Últimas mascotas (home) ──────────────────────────────────────────────────

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`));