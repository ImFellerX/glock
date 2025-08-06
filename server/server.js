require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sgMail = require('@sendgrid/mail');
const path = require('path');
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const validator = require('validator');
const bodyParser = require('body-parser');
const app = express();

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

console.log("🔑 Stripe key loaded:", process.env.STRIPE_SECRET_KEY ? "✅ Loaded" : "❌ Missing");

// ---------------- Middleware ----------------
app.use(helmet({ contentSecurityPolicy: false }));

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { message: "Too many requests from this IP. Try again later." },
});

app.use("/api/register", authLimiter);
app.use("/api/forgot-password", authLimiter);

const allowedOrigins = [
    'http://localhost:3000',
    'https://cloud-gaming-project.onrender.com',
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));

// ---------------- SendGrid Validation ----------------
if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM) {
    console.error('❌ Missing SendGrid environment variables.');
    process.exit(1);
}
if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('❌ Missing Stripe environment variables.');
    process.exit(1);
}

// ---------------- Firebase Admin Initialization ----------------
const admin = require("firebase-admin");

admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL
    })
});

const db = admin.firestore();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const PORT = process.env.PORT || 3000;

// ---------------- Stripe Webhook ----------------
app.post('/api/stripe-webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userId = session.metadata.userId;
        const amount = Number(session.metadata.amount);
        if (userId && amount) {
            try {
                const userRef = db.collection("users").doc(userId);
                await db.runTransaction(async (transaction) => {
                    const doc = await transaction.get(userRef);
                    if (!doc.exists) throw new Error("User not found");
                    const currentFunds = doc.data().credits || 0;
                    const newBalance = currentFunds + amount;
                    transaction.update(userRef, {
                        credits: newBalance,
                        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                    });
                });
            } catch (error) {
                console.error("❌ Funds update error via webhook:", error.message);
                return res.status(500).json({ received: true, message: "Funds not updated." });
            }
        }
    }
    res.json({ received: true });
});

// ---------------- Middleware ----------------
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ---------------- Auth Middleware ----------------
async function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Missing or invalid token' });
    }
    const idToken = authHeader.split(' ')[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        if (!decodedToken.email_verified) {
            return res.status(403).json({ message: 'Email not verified' });
        }
        req.user = decodedToken;
        next();
    } catch (error) {
        console.error('Token verification failed:', error.message);
        return res.status(401).json({ message: 'Unauthorized' });
    }
}

// ---------------- Register ----------------
app.post('/api/register', async (req, res) => {
    let { fullName, email, country, uid } = req.body;
    try {
        if (!fullName || fullName.length < 2 || fullName.length > 50) {
            return res.status(400).json({ message: 'Full name must be 2–50 characters long' });
        }
        if (!email || !validator.isEmail(email)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }
        if (!country || country.length < 2 || country.length > 50) {
            return res.status(400).json({ message: 'Invalid country name' });
        }
        if (!uid) {
            return res.status(400).json({ message: 'Missing UID' });
        }
        fullName = validator.escape(fullName.trim());
        email = validator.normalizeEmail(email);
        country = validator.escape(country.trim());
        await db.collection('users').doc(uid).set({
            fullName,
            email,
            country,
            credits: 0.0,
            isVerified: false,
        });
        return res.status(201).json({ message: 'User profile created successfully!' });
    } catch (error) {
        console.error('❌ Registration error:', error);
        return res.status(500).json({ message: 'An error occurred during registration.' });
    }
});

// ---------------- Login ----------------
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        const fetch = (await import('node-fetch')).default;

        const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, returnSecureToken: true })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(401).json({ message: data.error?.message || "Invalid credentials" });
        }

        return res.json({
            message: "Login successful",
            token: data.idToken,
            refreshToken: data.refreshToken,
            expiresIn: data.expiresIn
        });

    } catch (error) {
        console.error('❌ Login error:', error);
        return res.status(500).json({ message: 'Internal server error during login.' });
    }
});

// ---------------- Get User ----------------
app.get("/api/user", authenticateToken, async (req, res) => {
    try {
        const userDoc = await db.collection('users').doc(req.user.uid).get();
        if (!userDoc.exists) return res.status(404).json({ message: 'User not found.' });
        return res.json(userDoc.data());
    } catch (error) {
        console.error('❌ Fetch user error:', error);
        return res.status(500).json({ message: 'Failed to fetch user data.' });
    }
});

// ---------------- Get Funds ----------------
app.get("/api/funds", authenticateToken, async (req, res) => {
    try {
        const userDoc = await db.collection('users').doc(req.user.uid).get();
        if (!userDoc.exists) return res.status(404).json({ message: 'User not found.' });
        return res.json({ funds: userDoc.data().credits });
    } catch (error) {
        console.error('❌ Funds fetch error:', error);
        return res.status(500).json({ message: 'Failed to fetch funds.' });
    }
});

// ---------------- Stripe Checkout ----------------
app.post("/api/payments/create-checkout-session", authenticateToken, async (req, res) => {
    const { amount } = req.body;
    const user = req.user;
    if (!amount || amount < 5) {
        return res.status(400).json({ message: "Invalid amount. Minimum is $5." });
    }
    const API_BASE = process.env.FRONTEND_URL || 'https://glockus.com';
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: { name: 'Cloud Gaming Credits' },
                    unit_amount: amount * 100,
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${API_BASE}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${API_BASE}/cancel.html`,
            metadata: { userId: user.uid, amount: amount },
        });
        res.json({ url: session.url });
    } catch (error) {
        console.error("Stripe Checkout Error:", error);
        res.status(500).json({ message: "Failed to create Stripe checkout session." });
    }
});

// ---------------- Deduct Funds ----------------
app.post("/api/funds/deduct", authenticateToken, async (req, res) => {
    const amount = Number(req.body.amount);
    if (!req.body.amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({ message: "Invalid or missing amount" });
    }
    try {
        const userRef = db.collection("users").doc(req.user.uid);
        let newBalance = 0;
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(userRef);
            if (!doc.exists) throw new Error("User not found");
            const currentFunds = doc.data().credits || 0;
            if (currentFunds < amount) throw new Error("Insufficient funds");
            newBalance = currentFunds - amount;
            transaction.update(userRef, {
                credits: newBalance,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            });
        });
        return res.json({ message: "Funds deducted successfully", balance: newBalance });
    } catch (error) {
        console.error("Funds deduct error:", error.message);
        return res.status(400).json({ message: error.message || "Unable to deduct funds" });
    }
});

// ---------------- Forgot Password ----------------
app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const resetLink = await admin.auth().generatePasswordResetLink(email);
        const msg = {
            to: email,
            from: process.env.SENDGRID_FROM,
            subject: 'gLockus: Password Reset Request',
            html: `<p>Click below to reset your password:</p><a href="${resetLink}">Reset My Password</a>`
        };
        await sgMail.send(msg);
        return res.status(200).json({ message: 'If an account exists, a password reset link has been sent.' });
    } catch (error) {
        console.error('❌ Password reset error:', error);
        return res.status(200).json({ message: 'If an account exists, a password reset link has been sent.' });
    }
});

// ---------------- Start Server ----------------
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});

// ---------------- Handle SPA ----------------
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});
