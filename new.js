const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const users = require('./MOCK_DATA.json');
const admins = require('./ADMIN_DATA.json');
const app = express();
const cors = require('cors');
const PORT = process.env.PORT || 3000;
const fs = require('fs');

const secret = 'hamail@101'; 

app.use(bodyParser.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors({
    origin: 'http://localhost:5173', // Allow only this origin to access the server
    methods: ['GET', 'POST', 'PATCH', 'DELETE'], // Allow only these methods
    allowedHeaders: ['Content-Type', 'Authorization'] // Allow only these headers
}));

// Middleware to verify JWT token
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

// Login route
app.post('/login/user', (req, res) => {
    const { email, name } = req.body;
    const user = users.find(u => u.email == email && u.first_name == name);
    if (user) {
        const token = jwt.sign({ email: user.email, name: user.first_name }, secret, { expiresIn: '2m' });
        return res.json({ status: "success", token, user });
    }
    else {
        return res.status(401).json({ status: "error", message: "Invalid credentials" });
    }
});
app.post('/login/admin', (req, res) => {
    const { email, name } = req.body;
    const admin = admins.find(a => a.email == email && a.first_name == name);
    if (admin){
        const token = jwt.sign({ email: admin.email, name: admin.first_name }, secret, { expiresIn: '3m' });
        return res.json({ status: "success", token, admin });
    }
    else {
        return res.status(401).json({ status: "error", message: "Invalid credentials" });
    }
});

// Routes 
app.get("/users", (req, res) => {
    const html = `
    <ul>
        ${users.map(user => `<li>${user.first_name}</li>`).join('')}
    </ul>
    `;
    return res.send(html);
});

// REST API
app.get("/api/users", (req, res) => {
    return res.json(users);
});

app.route('/api/users/:id')
    .get(authenticateToken, (req, res) => { // Protecting the route
        const id = Number(req.params.id);
        const user = users.find((user) => user.id === id);
        if (user) {
            return res.json(user);
        } else {
            return res.status(404).json({ status: "error", message: "User not found" });
        }
     });
//     .patch(authenticateToken, (req, res) => { // Protecting the route
//         const userId = req.params.id;
//         const updatedData = req.body;
//         const userIndex = users.findIndex(user => user.id === userId);
//         if (userIndex !== -1) {
//             users[userIndex] = { ...users[userIndex], ...updatedData };

//             fs.writeFile('./MOCK_DATA.json', JSON.stringify(users), (err) => {
//                 if (err) {
//                     return res.status(500).json({ status: "error", message: "Failed to update user data" });
//                 }
//                 return res.json({ status: "success", user: users[userIndex] });
//             });
//         } else {
//             return res.status(404).json({ status: "error", message: "User not found" });
//         }
//     })
//     .delete(authenticateToken, (req, res) => { // Protecting the route
//         const userId = req.params.id;
//         const userIndex = users.findIndex(user => user.id === userId);

//         if (userIndex !== -1) {
//             users.splice(userIndex, 1);

//             fs.writeFile('./MOCK_DATA.json', JSON.stringify(users), (err) => {
//                 if (err) {
//                     return res.status(500).json({ status: "error", message: "Failed to delete user data" });
//                 }
//                 console.log("deleted");
//                 return res.json({ status: "success", message: "User deleted successfully" });
//             });
//         } else {
//             return res.status(404).json({ status: "error", message: "User not found" });
//         }
//     });

// app.post("/api/users", authenticateToken, (req, res) => { // Protecting the route
//     const body = req.body;
//     const newUser = { ...body, id: users.length + 1 };
//     users.push(newUser);

//     fs.writeFile('./MOCK_DATA.json', JSON.stringify(users, null, 2), (err) => {
//         if (err) {
//             return res.status(500).json({ status: "error", message: "Failed to add new user" });
//         }
//         return res.json({ status: "success", id: newUser.id });
//     });
// });

app.listen(PORT, () => console.log(`Server started at Port: ${PORT}`));

const PORTA = process.env.PORTA || 4000;

// Routes Admin 
app.get("/admins", (req, res) => {
    const html = `
    <ul>
        ${admins.map(admin => `<li>${admin.first_name}</li>`).join('')}
    </ul>
    `;
    return res.send(html);
});

// REST API Admin
app.get("/api/admins", (req, res) => {
    return res.json(admins);
});

app.route('/api/admins/:id')
    .get(authenticateToken, (req, res) => { // Protecting the route
        const id = Number(req.params.id);
        const admin = admins.find((admin) => admin.id === id);
        if (admin) {
            return res.json(admin);
        } else {
            return res.status(404).json({ status: "error", message: "Admin not found" });
        }
    })
    .patch(authenticateToken, (req, res) => { // Protecting the route
        const adminId = req.params.id;
        const updatedData = req.body;
        const adminIndex = admins.findIndex(admin => admin.id === adminId);
        if (adminIndex !== -1) {
            admins[adminIndex] = { ...admins[adminIndex], ...updatedData };

            fs.writeFile('./ADMIN_DATA.json', JSON.stringify(admins), (err) => {
                if (err) {
                    return res.status(500).json({ status: "error", message: "Failed to update admin data" });
                }
                return res.json({ status: "success", admin: admins[adminIndex] });
            });
        } else {
            return res.status(404).json({ status: "error", message: "Admin not found" });
        }
    })
    .delete(authenticateToken, (req, res) => { // Protecting the route
        const adminId = req.params.id;
        const adminIndex = admins.findIndex(admin => admin.id === adminId);

        if (adminIndex !== -1) {
            admins.splice(adminIndex, 1);

            fs.writeFile('./ADMIN_DATA.json', JSON.stringify(admins), (err) => {
                if (err) {
                    return res.status(500).json({ status: "error", message: "Failed to delete admin data" });
                }
                console.log("deleted");
                return res.json({ status: "success", message: "Admin deleted successfully" });
            });
        } else {
            return res.status(404).json({ status: "error", message: "Admin not found" });
        }
    });

app.post("/api/admins", authenticateToken, (req, res) => { // Protecting the route
    const body = req.body;
    const newAdmin = { ...body, id: admins.length + 1 };
    admins.push(newAdmin);

    fs.writeFile('./ADMIN_DATA.json', JSON.stringify(admins, null, 2), (err) => {
        if (err) {
            return res.status(500).json({ status: "error", message: "Failed to add new admin" });
        }
        return res.json({ status: "success", id: newAdmin.id });
    });
});

app.listen(PORTA, () => console.log(`Server started at Port: ${PORTA}`));