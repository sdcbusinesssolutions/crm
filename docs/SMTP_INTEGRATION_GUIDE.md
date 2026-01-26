# SMTP Integration & Email Delivery Guide

## 1. Overview
The SMTP Integration module allows the application to send transactional and automation emails using **any** external SMTP server (e.g., cPanel/Webmail, Zoho, Office365, Gmail, SendGrid).

This document details the technical implementation, security validation logic, and configuration best practices.

## 2. Technology Stack
- **Library**: `nodemailer` (Standard Node.js module for email)
- **Transport Security**: Supports both SSL (Implicit) and STARTTLS (Explicit).
- **Identity**: Dynamic HELO/EHLO Identity Generation.

## 3. Connection Modes & Ports
The system supports two primary modes of encryption. Using the correct port is critical for successful connection.

### A. SSL (Implicit TLS) -- **Recommended**
- **Port**: `465` (Standard)
- **Mechanism**: Connection is encrypted *immediately* upon handshake.
- **Best For**: cPanel Hostings (Hostinger, Bluehost, GoDaddy, Namecheap).
- **Config**:
  - `secure: true`
  - `rejectUnauthorized: false` (Compatible with self-signed certs)

### B. TLS (STARTTLS)
- **Port**: `587` (Standard)
- **Mechanism**: Connection starts as plain text, then upgrades to encrypted via `STARTTLS` command.
- **Best For**: Office 365, Outlook, older Exchange servers.
- **Config**:
  - `secure: false` (Must be false to allow the upgrade command)
  - `requireTLS: true`

## 4. Security & Validation Logic ("The Fixes")

To ensure high deliverability and bypass common errors ("Invalid Host", "Spam Blocked"), the following logic is enforced in `server/services/SmtpService.js`:

### 4.1. Dynamic HELO/EHLO Identity (Spam Filter Fix)
**Problem**: By default, Node.js scripts identify themselves as `localhost` or `[127.0.0.1]`.
**Result**: Spam filters (especially Gmail and Enterprise filters) reject these immediately as "Bot traffic".
**Solution**:
The system dynamically sets the `name` property of the transporter to the **Host Domain**.
```javascript
// Generic Implementation in SmtpService.js
hostname: config.host // e.g., 'mail.upshopi.com'
```
*Effect: The server greets as "EHLO mail.upshopi.com", which matches the expected reverse DNS patterns, passing spam checks.*

### 4.2. Self-Signed Certificate Compatibility
**Problem**: Many shared hosting providers share a single SSL certificate across thousands of domains, causing `CERT_HAS_EXPIRED` or `DEPTH_ZERO_SELF_SIGNED_CERT` errors.
**Solution**:
```javascript
tls: {
    rejectUnauthorized: false 
}
```
*Effect: The connection remains encrypted (Secure), but we do not strictly validate the Chain of Trust. This enables cPanel emails to work reliably.*

### 4.3. Host Environment Fix (Proxy Bypass)
**Problem**: deployed environments with Global Proxy settings interfere with SMTP handshakes.
**Solution**:
We bypass global proxy settings for specific SMTP connections if required, using direct socket connections via `nodemailer`.

## 5. Configuration Guide

When adding a new connection in the dashboard/UI:

| Field | Value for cPanel/Webmail | Value for Gmail/Workspace |
| :--- | :--- | :--- |
| **Host** | `mail.yourdomain.com` | `smtp.gmail.com` |
| **Port** | `465` | `465` |
| **Encryption** | `SSL (Implicit)` | `SSL (Implicit)` |
| **Username** | `info@yourdomain.com` | `yourname@gmail.com` |
| **Password** | *Use your Email Password* | *Use App Password* (Required for Gmail) |

## 6. Troubleshooting

| Error | Cause | Fix |
| :--- | :--- | :--- |
| **Connection Timeout** | Wrong Port or Firewall | Check if Port 465/587 is open. Try switching ports. |
| **Invalid Login** | Wrong Password | Ensure you are using the correct password. For Gmail, you **MUST** use an App Password. |
| **EAUTH / 535** | Authentication Failed | Check Username/Password. |
| **550 rejected** | Spam Filter | The server blocked the content. Ensure your Subject/Body looks realistic, not "test". |
| **Message Queued** | Server Queue | Your SMTP server accepted it (`250 OK`), but hasn't delivered it yet. Check your cPanel "Track Delivery". |
