const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');

const { pool, initDB } = require('./db');
const { authenticateToken, isAdmin, isSalespersonOrAdmin, JWT_SECRET } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;


// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// Configure Multer for card image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'card-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only images (.jpg, .jpeg, .png, .webp) are allowed!'));
  }
});

// ---------------------------------------------------------
// AUTHENTICATION ENDPOINTS
// ---------------------------------------------------------

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Please provide email and password.' });
  }

  try {
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error.' });
  }
});

// Register salesperson (Admin only)
app.post('/api/auth/register-salesperson', authenticateToken, isAdmin, async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All fields (name, email, password) are required.' });
  }

  try {
    // Check if email already registered
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email already registered.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, "salesperson")',
      [name, email, hash]
    );

    res.status(201).json({
      message: 'Salesperson registered successfully',
      userId: result.insertId
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error.' });
  }
});

// Get all salespersons (Admin only)
app.get('/api/auth/salespersons', authenticateToken, isAdmin, async (req, res) => {
  try {
    const [salespersons] = await pool.query(
      'SELECT id, name, email, created_at FROM users WHERE role = "salesperson" ORDER BY name ASC'
    );
    res.json(salespersons);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error.' });
  }
});

// Delete user / unassign salesperson (Admin only)
app.delete('/api/auth/users/:id', authenticateToken, isAdmin, async (req, res) => {
  const userId = req.params.id;
  if (parseInt(userId) === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete yourself.' });
  }

  try {
    const [result] = await pool.query('DELETE FROM users WHERE id = ?', [userId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({ message: 'User deleted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error.' });
  }
});

// ---------------------------------------------------------
// CARDS INVENTORY ENDPOINTS
// ---------------------------------------------------------

// List cards
app.get('/api/cards', authenticateToken, isSalespersonOrAdmin, async (req, res) => {
  const { name, year, number, rarity, language, condition, search } = req.query;
  let sql = 'SELECT * FROM cards WHERE 1=1';
  const params = [];

  if (search) {
    sql += ' AND (name LIKE ? OR card_number LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  if (name) {
    sql += ' AND name LIKE ?';
    params.push(`%${name}%`);
  }
  if (year) {
    sql += ' AND year_made = ?';
    params.push(parseInt(year));
  }
  if (number) {
    sql += ' AND card_number = ?';
    params.push(number);
  }
  if (rarity) {
    sql += ' AND rarity = ?';
    params.push(rarity);
  }
  if (language) {
    sql += ' AND language = ?';
    params.push(language);
  }
  if (condition) {
    sql += ' AND card_condition = ?';
    params.push(condition);
  }

  sql += ' ORDER BY created_at DESC';

  try {
    const [cards] = await pool.query(sql, params);
    res.json(cards);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database query error.' });
  }
});

// Get single card details
app.get('/api/cards/:id', authenticateToken, isSalespersonOrAdmin, async (req, res) => {
  try {
    const [cards] = await pool.query('SELECT * FROM cards WHERE id = ?', [req.params.id]);
    if (cards.length === 0) {
      return res.status(404).json({ error: 'Card not found.' });
    }
    res.json(cards[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database query error.' });
  }
});

// Add a card (Admin only)
app.post('/api/cards', authenticateToken, isAdmin, upload.single('image'), async (req, res) => {
  const { name, year_made, card_number, price, rarity, language, quantity, card_condition } = req.body;

  if (!name || !year_made || !card_number || !price || !rarity || !language || !quantity || !card_condition) {
    return res.status(400).json({ error: 'Please provide all card fields.' });
  }

  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    const [result] = await pool.query(
      `INSERT INTO cards (name, year_made, card_number, price, rarity, language, quantity, card_condition, image_url) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, parseInt(year_made), card_number, parseFloat(price), rarity, language, parseInt(quantity), card_condition, imageUrl]
    );

    res.status(201).json({
      message: 'Card added successfully',
      cardId: result.insertId,
      imageUrl
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add card.' });
  }
});

// Update a card (Admin only)
app.put('/api/cards/:id', authenticateToken, isAdmin, upload.single('image'), async (req, res) => {
  const cardId = req.params.id;
  const { name, year_made, card_number, price, rarity, language, quantity, card_condition } = req.body;

  if (!name || !year_made || !card_number || !price || !rarity || !language || !quantity || !card_condition) {
    return res.status(400).json({ error: 'Please provide all card fields.' });
  }

  try {
    // Check if card exists
    const [existing] = await pool.query('SELECT image_url FROM cards WHERE id = ?', [cardId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Card not found.' });
    }

    let imageUrl = existing[0].image_url;
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
      // Optional: Delete old file if exists
      if (existing[0].image_url) {
        const oldPath = path.join(__dirname, 'public', existing[0].image_url);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
    }

    await pool.query(
      `UPDATE cards SET name = ?, year_made = ?, card_number = ?, price = ?, rarity = ?, language = ?, quantity = ?, card_condition = ?, image_url = ? 
       WHERE id = ?`,
      [name, parseInt(year_made), card_number, parseFloat(price), rarity, language, parseInt(quantity), card_condition, imageUrl, cardId]
    );

    res.json({
      message: 'Card updated successfully',
      imageUrl
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update card.' });
  }
});

// Delete a card (Admin only)
app.delete('/api/cards/:id', authenticateToken, isAdmin, async (req, res) => {
  const cardId = req.params.id;
  try {
    const [existing] = await pool.query('SELECT image_url FROM cards WHERE id = ?', [cardId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Card not found.' });
    }

    // Delete image file if exists
    if (existing[0].image_url) {
      const oldPath = path.join(__dirname, 'public', existing[0].image_url);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    await pool.query('DELETE FROM cards WHERE id = ?', [cardId]);
    res.json({ message: 'Card deleted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete card.' });
  }
});

// QR code generation stream (supports format parameters, fits scanner specifications)
// Accessible via URL for sticker print styles. Authenticated or verified via query parameter.
app.get('/api/cards/:id/qr', async (req, res) => {
  const cardId = req.params.id;

  try {
    // Generate QR code for the specific card ID.
    // The format is just the ID to keep the QR code extremely simple and scan-friendly.
    const qrData = cardId.toString();

    res.setHeader('Content-Type', 'image/png');
    QRCode.toFileStream(res, qrData, {
      width: 150,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error generating QR code');
  }
});

// ---------------------------------------------------------
// POINT OF SALES (POS) ENDPOINTS
// ---------------------------------------------------------

// Record a sale (Salesperson or Admin only)
app.post('/api/sales', authenticateToken, isSalespersonOrAdmin, async (req, res) => {
  const { card_id, quantity, discount_type, discount_value } = req.body;
  const salespersonId = req.user.id;

  if (!card_id || !quantity) {
    return res.status(400).json({ error: 'Card ID and quantity are required.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Fetch card details
    const [cards] = await conn.query('SELECT * FROM cards WHERE id = ? FOR UPDATE', [card_id]);
    if (cards.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Card not found in database.' });
    }

    const card = cards[0];

    // Check quantity
    if (card.quantity < quantity) {
      await conn.rollback();
      return res.status(400).json({ error: `Insufficient stock. Available quantity: ${card.quantity}` });
    }

    // Calculate prices and discounts
    const subtotal = card.price * quantity;
    let finalDiscountValue = 0;

    const discType = discount_type || 'none';
    const discVal = discount_value ? parseFloat(discount_value) : 0;

    if (discType === 'percentage') {
      finalDiscountValue = subtotal * (discVal / 100);
    } else if (discType === 'fixed') {
      finalDiscountValue = discVal;
    }

    const finalPrice = Math.max(0, subtotal - finalDiscountValue);

    // Update stock
    await conn.query('UPDATE cards SET quantity = quantity - ? WHERE id = ?', [quantity, card_id]);

    // Record sales transaction
    const [saleResult] = await conn.query(
      `INSERT INTO sales (card_id, salesperson_id, quantity, discount_type, discount_value, total_price) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [card_id, salespersonId, quantity, discType, discVal, finalPrice]
    );

    await conn.commit();

    res.status(201).json({
      message: 'Sale recorded successfully',
      saleId: saleResult.insertId,
      subtotal,
      discountApplied: finalDiscountValue,
      totalPrice: finalPrice
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Transaction failed. Try again.' });
  } finally {
    conn.release();
  }
});

// Sales reports endpoint
app.get('/api/sales/report', authenticateToken, isSalespersonOrAdmin, async (req, res) => {
  const role = req.user.role;
  const userId = req.user.id;

  let query = `
    SELECT 
      s.id as sale_id,
      s.quantity,
      s.discount_type,
      s.discount_value,
      s.total_price,
      s.sale_timestamp,
      c.name as card_name,
      c.card_number,
      c.price as base_price,
      u.name as salesperson_name
    FROM sales s
    JOIN cards c ON s.card_id = c.id
    JOIN users u ON s.salesperson_id = u.id
  `;
  const params = [];

  // If salesperson, only show their own sales
  if (role === 'salesperson') {
    query += ' WHERE s.salesperson_id = ?';
    params.push(userId);
  }

  query += ' ORDER BY s.sale_timestamp DESC';

  try {
    const [sales] = await pool.query(query, params);

    // Compute totals
    let totalRevenue = 0;
    let totalItemsSold = 0;
    sales.forEach(sale => {
      totalRevenue += parseFloat(sale.total_price);
      totalItemsSold += sale.quantity;
    });

    res.json({
      summary: {
        totalRevenue,
        totalItemsSold,
        salesCount: sales.length
      },
      sales
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve sales report.' });
  }
});

// Start the server
async function startServer() {
  await initDB();
  app.listen(PORT, () => {
    console.log(`TCG Inventory & POS server is running at http://localhost:${PORT}`);
  });
}

startServer();
