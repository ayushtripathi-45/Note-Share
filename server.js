const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const mysql = require('mysql2/promise');
const multer = require('multer');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'note_share_secret';
const DB_NAME = process.env.DB_NAME || 'note_share';

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
};

let pool;
const uploadDir = path.join(__dirname, 'uploads');

async function initDb() {
  try {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const connection = await mysql.createConnection({ ...dbConfig, database: undefined });
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.end();
    pool = mysql.createPool({ ...dbConfig, database: DB_NAME });
  } catch (err) {
    console.error('MySQL connection failed:', err.message || err);
    throw new Error('MySQL connection failed. Ensure your MySQL server is running and the host/port in .env are correct.');
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${safeName}`);
  },
});
const upload = multer({ storage });

async function query(sql, params) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function ensureSchema() {
  await query(`CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    avatar VARCHAR(8) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);

  await query(`CREATE TABLE IF NOT EXISTS notes (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL,
    tag VARCHAR(100),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    attachment_path VARCHAR(255) NULL,
    attachment_name VARCHAR(255) NULL,
    attachment_type VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);

  const attachmentColumn = await query(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema = ? AND table_name = 'notes' AND COLUMN_NAME = 'attachment_path'",
    [DB_NAME]
  );
  if (!attachmentColumn.length) {
    await query(`ALTER TABLE notes 
      ADD COLUMN attachment_path VARCHAR(255) NULL,
      ADD COLUMN attachment_name VARCHAR(255) NULL,
      ADD COLUMN attachment_type VARCHAR(100) NULL;
    `);
  }

  await query(`CREATE TABLE IF NOT EXISTS friends (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL,
    friend_id VARCHAR(32) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_friend_pair (user_id, friend_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);

  await query(`CREATE TABLE IF NOT EXISTS requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    from_user_id VARCHAR(32) NOT NULL,
    to_user_id VARCHAR(32) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);

  await query(`CREATE TABLE IF NOT EXISTS chats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id VARCHAR(100) NOT NULL,
    from_user_id VARCHAR(32) NOT NULL,
    to_user_id VARCHAR(32) NOT NULL,
    text TEXT NOT NULL,
    ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
}

function createToken(user) {
  return jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
}

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    const [user] = await query('SELECT id, name, email, avatar FROM users WHERE id = ?', [payload.id]);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

const app = express();
app.use(cors());

// Custom middleware: only parse JSON if Content-Type is application/json
app.use((req, res, next) => {
  if (req.is('application/json')) {
    express.json()(req, res, next);
  } else {
    next();
  }
});

app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });

    const existing = await query('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existing.length) return res.status(400).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const avatar = name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
    const id = `U${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    await query('INSERT INTO users (id, name, email, password, avatar) VALUES (?, ?, ?, ?, ?)', [id, name, email.toLowerCase(), hashed, avatar]);

    const token = createToken({ id });
    return res.status(201).json({ user: { id, name, email: email.toLowerCase(), avatar }, token });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const identifier = req.body.identifier || req.body.email;
    const password = req.body.password;
    if (!identifier || !password) return res.status(400).json({ error: 'Missing fields' });

    const [user] = await query(
      'SELECT id, name, email, password, avatar FROM users WHERE email = ? OR id = ?',
      [identifier.toLowerCase(), identifier]
    );
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Invalid credentials' });

    const token = createToken(user);
    return res.json({ user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar }, token });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/me', authMiddleware, (req, res) => {
  return res.json({ user: req.user });
});

app.get('/api/users', authMiddleware, async (req, res) => {
  try {
    const users = await query('SELECT id, name, avatar FROM users WHERE id != ? ORDER BY name ASC', [req.user.id]);
    return res.json({ users });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to fetch users' });
  }
});

app.get('/api/friends', authMiddleware, async (req, res) => {
  try {
    const friends = await query(
      'SELECT u.id, u.name, u.avatar FROM friends f JOIN users u ON u.id = f.friend_id WHERE f.user_id = ? ORDER BY u.name ASC',
      [req.user.id]
    );
    return res.json({ friends });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to fetch friends' });
  }
});

app.get('/api/requests', authMiddleware, async (req, res) => {
  try {
    const requests = await query(
      'SELECT r.from_user_id AS fromId, u.name, u.avatar, r.created_at AS createdAt FROM requests r JOIN users u ON u.id = r.from_user_id WHERE r.to_user_id = ? ORDER BY r.created_at DESC',
      [req.user.id]
    );
    return res.json({ requests });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to fetch friend requests' });
  }
});

app.post('/api/friends/requests', authMiddleware, async (req, res) => {
  try {
    const targetId = req.body.targetId?.trim();
    if (!targetId) return res.status(400).json({ error: 'Target Friend ID is required' });
    if (targetId === req.user.id) return res.status(400).json({ error: 'Cannot send request to yourself' });

    const [targetUser] = await query('SELECT id, name FROM users WHERE id = ?', [targetId]);
    if (!targetUser) return res.status(404).json({ error: 'Target user not found' });

    const existingFriend = await query('SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ?', [req.user.id, targetId]);
    if (existingFriend.length) return res.status(400).json({ error: 'Already friends' });

    const existingRequest = await query('SELECT 1 FROM requests WHERE from_user_id = ? AND to_user_id = ?', [req.user.id, targetId]);
    if (existingRequest.length) return res.status(400).json({ error: 'Friend request already sent' });

    const reverseRequest = await query('SELECT id FROM requests WHERE from_user_id = ? AND to_user_id = ?', [targetId, req.user.id]);
    if (reverseRequest.length) {
      await query('DELETE FROM requests WHERE id = ?', [reverseRequest[0].id]);
      await query('INSERT IGNORE INTO friends (user_id, friend_id) VALUES (?, ?), (?, ?)', [req.user.id, targetId, targetId, req.user.id]);
      return res.json({ accepted: true, friend: { id: targetUser.id, name: targetUser.name } });
    }

    await query('INSERT INTO requests (from_user_id, to_user_id) VALUES (?, ?)', [req.user.id, targetId]);
    return res.status(201).json({ request: { fromId: req.user.id, name: req.user.name, avatar: req.user.avatar } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to send friend request' });
  }
});

app.post('/api/friends/requests/:fromId/accept', authMiddleware, async (req, res) => {
  try {
    const fromId = req.params.fromId;
    const [request] = await query('SELECT id FROM requests WHERE from_user_id = ? AND to_user_id = ?', [fromId, req.user.id]);
    if (!request) return res.status(404).json({ error: 'Friend request not found' });

    await query('DELETE FROM requests WHERE id = ?', [request.id]);
    await query('INSERT IGNORE INTO friends (user_id, friend_id) VALUES (?, ?), (?, ?)', [req.user.id, fromId, fromId, req.user.id]);

    const [friend] = await query('SELECT id, name, avatar FROM users WHERE id = ?', [fromId]);
    return res.json({ friend });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to accept friend request' });
  }
});

app.post('/api/friends/requests/:fromId/reject', authMiddleware, async (req, res) => {
  try {
    const fromId = req.params.fromId;
    const result = await query('DELETE FROM requests WHERE from_user_id = ? AND to_user_id = ?', [fromId, req.user.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Friend request not found' });
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to reject friend request' });
  }
});

app.get('/api/notes', authMiddleware, async (req, res) => {
  try {
    const rows = await query('SELECT id, tag, title, content, attachment_path AS attachmentPath, attachment_name AS attachmentName, attachment_type AS attachmentType, created_at AS createdAt, updated_at AS updatedAt FROM notes WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
    const notes = rows.map(note => ({
      ...note,
      attachmentUrl: note.attachmentPath ? `/uploads/${note.attachmentPath}` : null,
    }));
    return res.json({ notes });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to fetch notes' });
  }
});

app.post('/api/notes', authMiddleware, upload.single('attachment'), async (req, res) => {
  try {
    const { tag, title, content } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });
    const id = `N${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const attachmentPath = req.file ? req.file.filename : null;
    const attachmentName = req.file ? req.file.originalname : null;
    const attachmentType = req.file ? req.file.mimetype : null;
    await query(
      'INSERT INTO notes (id, user_id, tag, title, content, attachment_path, attachment_name, attachment_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, req.user.id, tag || 'General', title, content || '', attachmentPath, attachmentName, attachmentType]
    );
    return res.status(201).json({
      note: {
        id,
        tag: tag || 'General',
        title,
        content: content || '',
        attachmentUrl: attachmentPath ? `/uploads/${attachmentPath}` : null,
        attachmentName,
        createdAt: new Date(),
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to create note' });
  }
});

app.put('/api/notes/:id', authMiddleware, upload.single('attachment'), async (req, res) => {
  try {
    const { id } = req.params;
    const { tag, title, content } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const [existing] = await query('SELECT attachment_path, attachment_name, attachment_type FROM notes WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!existing) return res.status(404).json({ error: 'Note not found' });

    const attachmentPath = req.file ? req.file.filename : existing.attachment_path;
    const attachmentName = req.file ? req.file.originalname : existing.attachment_name;
    const attachmentType = req.file ? req.file.mimetype : existing.attachment_type;

    const result = await query(
      'UPDATE notes SET tag = ?, title = ?, content = ?, attachment_path = ?, attachment_name = ?, attachment_type = ? WHERE id = ? AND user_id = ?',
      [tag || 'General', title, content || '', attachmentPath, attachmentName, attachmentType, id, req.user.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Note not found' });
    return res.json({
      note: {
        id,
        tag: tag || 'General',
        title,
        content: content || '',
        attachmentUrl: attachmentPath ? `/uploads/${attachmentPath}` : null,
        attachmentName,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to update note' });
  }
});

app.delete('/api/notes/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM notes WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Note not found' });
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to delete note' });
  }
});

app.put('/api/me', authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const avatar = name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
    await query('UPDATE users SET name = ?, avatar = ? WHERE id = ?', [name, avatar, req.user.id]);
    return res.json({ user: { ...req.user, name, avatar } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to update profile' });
  }
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use((req, res, next) => {
  const blockedPaths = ['/server.js', '/package.json', '/package-lock.json', '/.env', '/.gitignore', '/db', '/db/', '/db/schema.sql'];
  if (blockedPaths.some(blocked => req.path === blocked || req.path.startsWith(blocked))) {
    return res.status(404).end();
  }
  next();
});

app.use(express.static(path.join(__dirname), {
  extensions: ['html', 'js', 'css', 'png', 'jpg', 'jpeg', 'svg', 'webp'],
  index: false,
}));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

initDb()
  .then(() => ensureSchema())
  .then(async () => {
    console.log('Database schema ready');
    const [existingUser] = await query('SELECT id FROM users WHERE id = ? OR email = ?', ['DEMO01', 'ayush@example.com']);
    if (!existingUser) {
      const hashed = await bcrypt.hash('password123', 10);
      await query('INSERT INTO users (id, name, email, password, avatar) VALUES (?, ?, ?, ?, ?)', ['DEMO01', 'Ayush Tripathi', 'ayush@example.com', hashed, 'AT']);
      await query('INSERT INTO users (id, name, email, password, avatar) VALUES (?, ?, ?, ?, ?)', ['DEMO02', 'Rahul Sharma', 'rahul@example.com', await bcrypt.hash('rahul123', 10), 'RS']);
      await query('INSERT INTO users (id, name, email, password, avatar) VALUES (?, ?, ?, ?, ?)', ['DEMO03', 'Priya Singh', 'priya@example.com', await bcrypt.hash('priya123', 10), 'PS']);
      const adminHashed = await bcrypt.hash('Ayush@2026', 10);
      await query('INSERT INTO users (id, name, email, password, avatar) VALUES (?, ?, ?, ?, ?)', ['AYX-ADMIN-001', 'Ayush Tripathi', 'ayush.admin@example.com', adminHashed, 'AT']);
      const demoHashed = await bcrypt.hash('11223', 10);
      await query('INSERT INTO users (id, name, email, password, avatar) VALUES (?, ?, ?, ?, ?)', ['DEMO-USER', 'Demo User', 'demouser@test.com', demoHashed, 'DU']);
      await query(`INSERT IGNORE INTO notes (id, user_id, tag, title, content, created_at) VALUES
        (?, ?, ?, ?, ?, ?),
        (?, ?, ?, ?, ?, ?),
        (?, ?, ?, ?, ?, ?)`, [
          'N001', 'DEMO01', 'AI/ML', 'Neural Networks Basics', 'A neural network is a series of algorithms that try to recognize patterns in data through a process that mimics how the human brain works.\n\nKey concepts:\n- Neurons and layers\n- Activation functions (ReLU, Sigmoid)\n- Backpropagation\n- Loss functions', '2026-05-28 12:00:00',
          'N002', 'DEMO01', 'COA', 'Cache Memory Notes', 'Cache memory is a small, high-speed memory located close to the CPU.\n\nTypes:\n- L1 Cache: Fastest, smallest (32-64 KB)\n- L2 Cache: Slower than L1, larger (256 KB - 1 MB)\n- L3 Cache: Shared across cores (4-16 MB)\n\nMapping techniques: Direct, Associative, Set Associative', '2026-05-30 10:15:00',
          'N003', 'DEMO01', 'SE', 'Agile Methodology', 'Agile is an iterative approach to project management and software development.\n\nKey principles:\n1. Customer collaboration over contract negotiation\n2. Responding to change over following a plan\n3. Individuals and interactions over processes and tools\n\nScrum framework: Sprints, Daily standups, Retrospectives', '2026-05-31 08:45:00'
      ]);
      const friendAccounts = [
        { id: 'FRD-ARJ-102', name: 'Arunam Jain', username: 'arunam.jain', password: 'Arunam@102' },
        { id: 'FRD-ARN-103', name: 'Aryan Nayak', username: 'aryan.nayak', password: 'Aryan@103' },
        { id: 'FRD-SRH-104', name: 'Shresth', username: 'shresth.dev', password: 'Shresth@104' },
        { id: 'FRD-SRY-105', name: 'Shreyansh', username: 'shreyansh.kr', password: 'Shreyansh@105' },
        { id: 'FRD-HMS-106', name: 'Himanshu', username: 'himanshu.exe', password: 'Himanshu@106' },
        { id: 'FRD-ABH-107', name: 'Ankur Bohare', username: 'ankur.bohare', password: 'Ankur@107' },
        { id: 'FRD-VDS-108', name: 'Vedansh', username: 'vedansh.notes', password: 'Vedansh@108' },
        { id: 'FRD-ATK-109', name: 'Atharva Kesharwani', username: 'atharva.k', password: 'Atharva@109' },
        { id: 'FRD-DRS-110', name: 'Darshika Shrivastava', username: 'darshika.s', password: 'Darshika@110' },
        { id: 'FRD-DPT-111', name: 'Deepak Tiwari', username: 'deepak.tw', password: 'Deepak@111' },
        { id: 'FRD-DKM-112', name: 'Daksh Malviya', username: 'daksh.m', password: 'Daksh@112' },
        { id: 'FRD-SVS-113', name: 'Shivani Soni', username: 'shivani.s', password: 'Shivani@113' },
        { id: 'FRD-AKM-114', name: 'Aakriti Mangal', username: 'aakriti.mn', password: 'Aakriti@114' },
        { id: 'FRD-DVG-115', name: 'Divyanshi Ghatiya', username: 'divyanshi.g', password: 'Divyanshi@115' },
        { id: 'FRD-DHD-116', name: 'Dhruv Diggiwal', username: 'dhruv.dg', password: 'Dhruv@116' },
      ];
      for (const friend of friendAccounts) {
        const [exists] = await query('SELECT id FROM users WHERE id = ?', [friend.id]);
        if (!exists) {
          const hashedPassword = await bcrypt.hash(friend.password, 10);
          const avatar = friend.name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
          await query('INSERT INTO users (id, name, email, password, avatar) VALUES (?, ?, ?, ?, ?)', [
            friend.id,
            friend.name,
            `${friend.username}@example.com`,
            hashedPassword,
            avatar,
          ]);
        }
      }
      console.log('Seeded demo users, friends, and notes');
    }
  })
  .then(() => {
    app.listen(PORT, () => {
      console.log(`NoteShare backend running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Schema initialization failed', err);
    process.exit(1);
  });
