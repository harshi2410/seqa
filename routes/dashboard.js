/**
 * Dashboard Web Page Routes
 * Serves HTML views for the Cybersecurity Dashboard, API Testing Sandbox, and Settings.
 */

const express = require('express');
const path = require('path');
const router = express.Router();

const VIEWS_DIR = path.join(__dirname, '..', 'views');

// Root redirects to Dashboard
router.get('/', (req, res) => {
  res.redirect('/dashboard');
});

// Main Cybersecurity Dashboard
router.get('/dashboard', (req, res) => {
  res.sendFile(path.join(VIEWS_DIR, 'dashboard.html'));
});

// API Testing & TAE Demo Sandbox
router.get('/dashboard/api-test', (req, res) => {
  res.sendFile(path.join(VIEWS_DIR, 'api-test.html'));
});

// Security & Rate Limiting Settings
router.get('/dashboard/settings', (req, res) => {
  res.sendFile(path.join(VIEWS_DIR, 'settings.html'));
});

module.exports = router;
