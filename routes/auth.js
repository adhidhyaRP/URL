import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/user.js';
import cookieParser from 'cookie-parser';
import nodemailer from 'nodemailer';
import { transporter } from '../index.js';

const router = express.Router();
router.use(cookieParser());
router.post('/signup', async (req, res) => {
    const { username, email, password } = req.body;
    try {
        // Check if user already exists
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ status: false, message: 'User already exists' });

        // Create new user
        const hashedPassword = await bcrypt.hash(password, 10);
        user = new User({ username, email, password: hashedPassword });
        await user.save();

        // Send verification email
        const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Signup Verification',
            html: `<p>Click <a href="http://localhost:5173/login">here</a> to verify your email.</p>`
        };
        await transporter.sendMail(mailOptions);

        res.status(201).json({ status: true, message: 'User created. Verification email sent.' });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ status: false, message: 'Error creating user' });
    }
});

// Login route
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        // Check if user exists
        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ status: false, message: 'User not registered' });

        // Check password
        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect) return res.status(401).json({ status: false, message: 'Incorrect password' });

        // Generate JWT token
        const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET);
        res.cookie('token', token, { httpOnly: true });
        res.status(200).json({ status: true, message: 'Login successful' });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ status: false, message: 'Login failed' });
    }
});

// Forgot password route
router.post('/forgotpassword', async (req, res) => {
    const { email } = req.body;
    try {
        // Check if user exists
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ status: false, message: 'User not found' });

        // Generate reset password token
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Reset Password',
            html: `<p>Click <a href="http://localhost:5173/resetpassword/${user._id}/${token}">here</a> to reset your password.</p>`
        };
        await transporter.sendMail(mailOptions);

        res.status(200).json({ status: true, message: 'Reset password email sent' });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ status: false, message: 'Error sending reset password email' });
    }
});

// Reset password route
router.post('/resetpassword/:id/:token', async (req, res) => {
    const { id, token } = req.params;
    const { password } = req.body;

    try {
        // Verify token
        jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
            if (err) return res.status(400).json({ status: false, message: 'Invalid token' });

            // Update password
            const hashedPassword = await bcrypt.hash(password, 10);
            await User.findByIdAndUpdate(id, { password: hashedPassword });
            res.status(200).json({ status: true, message: 'Password reset successful' });
        });
    } catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).json({ status: false, message: 'Error resetting password' });
    }
});
export default router;