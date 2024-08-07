const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const app = express();
const cors = require('cors');
const mysql = require("mysql");

const secret = 'hamail@101';

const db = mysql.createConnection({
    host: 'localhost',
    port: '3306',
    user: 'root',
    database: `ecommerce`,
    password: 'MyNewPass'
});

app.use(bodyParser.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors({
    origin: 'http://localhost:3000', 
    methods: ['GET', 'POST', 'PATCH', 'DELETE'], 
    allowedHeaders: ['Content-Type', 'Authorization'] 
}));

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.sendStatus(401);
    }
    jwt.verify(token, secret, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

const authorizeAdmin = (req, res, next) => {
    if (req.user.role_id !== 1) return res.sendStatus(403);
    next();
};

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    const sql = 'SELECT u.id as id, u.name as name, u.role_id as role_id FROM users u JOIN roletb r ON u.role_id = r.id WHERE email = ? AND password = ?;';
    
    db.query(sql, [email, password], (err, results) => {
      if (err || results.length === 0) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }
  
      const user = results[0];
      console.log("Users-->",user);
      const token = jwt.sign({ id: user.id, role_id: user.role_id }, secret, { expiresIn: '1h' });
      
      res.json({ token, role_id: user.role_id, name: user.name, id: user.id }); 
    });
});

app.get("/items", authenticateToken, (req, res) => {
    const sql = "SELECT * FROM items";
    db.query(sql, (err, data) => {
        if (err) {
            console.error("Database query error: ", err);
            return res.json(err);
        }
        return res.json(data);
    });
});

app.get("/items/orders", authenticateToken, (req, res) => {
  const sql = "SELECT * FROM orders";
  db.query(sql, (err, data) => {
      if (err) {
          console.error("Database query error: ", err);
          return res.json(err);
      }
      return res.json(data);
  });
});


app.route('/items/:name')
    .get(authenticateToken, (req, res) => { 
        const name = req.params.name;
        const sql = `SELECT * FROM items WHERE name LIKE '%${name}%'`;
        db.query(sql, (err, data) => {
            if (err) return res.status(404).json({ status: "error", message: "User not found" });
            return res.json(data);
        });
    });

    app.post('/items/order', authenticateToken, (req, res) => {
      const { id, orderItems } = req.body;
  
      if (!id || !Array.isArray(orderItems) || orderItems.length === 0) {
          return res.status(400).json({ error: 'Invalid input' });
      }
  
      let totalPrice = 0;
      const itemsPromises = orderItems.map(item => {
          const { name, qty, cartPrice } = item;
          totalPrice += qty * cartPrice;
  
          return new Promise((resolve, reject) => {
              db.query('UPDATE items SET stock_quantity = stock_quantity - ? WHERE name = ?', [qty, name], (err, result) => {
                  if (err) {
                      console.error('Error updating item quantity:', err);
                      return reject(err);
                  }
                  resolve();
              });
          });
      });
  
      Promise.all(itemsPromises)
          .then(() => {
              const orderDate = new Date();
              const deliveryDate = new Date();
              deliveryDate.setDate(orderDate.getDate() + 5);
  
              return new Promise((resolve, reject) => {
                  db.query('SELECT name FROM users WHERE id = ?', [id], (err, results) => {
                      if (err) {
                          console.error('Error fetching user:', err);
                          return reject(err);
                      }
                      if (results.length === 0) {
                          return reject(new Error('User not found'));
                      }
                      const username = results[0].name;
                      resolve({ username, orderDate, deliveryDate });
                  });
              });
          })
          .then(({ username, orderDate, deliveryDate }) => {
              const checkExistingOrders = orderItems.map(item => {
                  const { name } = item;
                  return new Promise((resolve, reject) => {
                      db.query('SELECT * FROM orders WHERE userid = ? AND order_item = ?', [id, name], (err, results) => {
                          if (err) {
                              console.error('Error checking existing orders:', err);
                              return reject(err);
                          }
                          resolve(results);
                      });
                  });
              });
  
              return Promise.all(checkExistingOrders)
                  .then(existingOrdersResults => {
                      const insertPromises = [];
                      const updatePromises = [];
                      const query = `
                          INSERT INTO orders (order_item, quantity, userid, name, orderedDate, deliveryDate, price, states)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                      `;
  
                      existingOrdersResults.forEach((results, index) => {
                          const { name, qty, cartPrice } = orderItems[index];
                          const state = 'In Progress'; 
  
                          if (results.length > 0) {
                              updatePromises.push(new Promise((resolve, reject) => {
                                  db.query('UPDATE orders SET quantity = quantity + ?, price = price + ?, states = ? WHERE userid = ? AND order_item = ?', [qty, qty * cartPrice, state, id, name], (err, result) => {
                                      if (err) {
                                          console.error('Error updating order:', err);
                                          return reject(err);
                                      }
                                      resolve();
                                  });
                              }));
                          } else {
                              insertPromises.push(new Promise((resolve, reject) => {
                                  db.query(query, [name, qty, id, username, orderDate, deliveryDate, qty * cartPrice, state], (err, result) => {
                                      if (err) {
                                          console.error('Error inserting order:', err);
                                          return reject(err);
                                      }
                                      resolve();
                                  });
                              }));
                          }
                      });
  
                      return Promise.all([...insertPromises, ...updatePromises]);
                  });
          })
          .then(() => {
              res.status(201).json({ message: 'Order processed successfully' });
          })
          .catch(err => {
              console.error('Failed to process order:', err);
              res.status(500).json({ error: 'Failed to process order' });
          });
  });

  app.patch('/orders/:id', authenticateToken, (req, res) => {
    const { id } = req.params; 
    const { state, reason } = req.body;
    console.log("ID: ", id);
    console.log("State: ", state);
    console.log("Reason: ", reason);

    
    if (!state) {
        return res.status(400).json({ message: 'State is required' });
    }

    let sql = 'UPDATE orders SET states = ?';
    let params = [state];

    if (state === 'Cancel' || state === 'Failed') {
        if (!reason) {
            return res.status(400).json({ message: 'Reason is required for Canceled or Failed states' });
        }
        sql += ', reason = ?';
        params.push(reason);
    }

    sql += ' WHERE id = ?';
    params.push(id);

    db.query(sql, params, (err, results) => {
        if (err) {
            console.error('Database query error: ', err);
            return res.status(500).json({ message: 'Database query error' });
        }

        if (results.affectedRows === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }

        res.json({ message: 'Order updated successfully' });
    });
});

app.route('/orders/:state')
    .get(authenticateToken, (req, res) => { 
        const state = req.params.state; 
        const sql = `SELECT u.id AS userId, u.name AS userName, COUNT(o.id) AS orderCount
        FROM orders o
        JOIN users u ON o.userid = u.id
        WHERE o.states = ?
        GROUP BY u.id, u.name`;

        db.query(sql, [state], (err, data) => {
            if (err) {
                console.error(err); 
                return res.status(500).json({ status: "error", message: "Internal server error" });
            }
            return res.json(data);
        });
    });

      app.post('/items', authenticateToken, (req, res) => {
        console.log('Request Body:', req.body);
        const { name, description, price, stock_quantity, images } = req.body;
    
        if (!name || !description || !price || stock_quantity === undefined || !images) {
            return res.status(400).json({ message: 'Missing required fields' });
        }
    
        const sql = 'INSERT INTO items (name, description, price, stock_quantity, images) VALUES (?, ?, ?, ?, ?)';
        
        db.query(sql, [name, description, price, stock_quantity, images], (err, result) => {
            if (err) {
                console.error('Error inserting item:', err);
                return res.status(500).json({ error: 'Failed to add new item' });
            }
            res.status(201).json({ message: 'Item added successfully', itemId: result.insertId });
        });
    });
      
  app.delete('/items/:id', authenticateToken, authorizeAdmin, (req, res) => {
    const itemId = req.params.id;

    db.beginTransaction(err => {
        if (err) {
            return res.status(500).json({ error: 'Could not start transaction' });
        }

        db.query('DELETE FROM items WHERE id = ?', [itemId], (err, result) => {
            if (err) {
                return db.rollback(() => {
                    res.status(500).json({ error: 'Error deleting item' });
                });
            }

            db.query(
                `UPDATE orders 
                  SET states = ?, reason = ? 
                  WHERE order_item = ?`,
                [6, 'item deleted by admin', itemId],
                (err, result) => {
                    if (err) {
                        return db.rollback(() => {
                            res.status(500).json({ error: 'Error updating orders' });
                        });
                    }

                    db.commit(err => {
                        if (err) {
                            return db.rollback(() => {
                                res.status(500).json({ error: 'Error committing transaction' });
                            });
                        }

                        res.status(200).json({ message: 'Item deleted and orders updated successfully' });
                    });
                }
            );
        });
    });
});
    
app.listen(4000, () => {
    console.log("Listening...");
});