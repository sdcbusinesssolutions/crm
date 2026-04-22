# Subscription & User Management System Updates
**Date:** April 22, 2026
**Project:** WPCode Multi-Tenant Platform

## 1. 🕒 Trial Period & Signup Logic
Every new user (whether self-signup or created by an Admin) is now automatically granted a configurable trial period.

- **Default Trial:** 7 Days (Configurable via `TRIAL_DAYS` in `.env` or `domains.csv`).
- **Plan Name:** Automatically set to `Free Trial`.
- **Database Trigger:** The `handle_new_user` trigger in `public.profiles` now stamps the expiration date immediately upon account creation.

---

## 2. 🛡️ User Deletion Permissions
We have implemented a strict permission hierarchy to protect customer data while allowing flexibility for trial cleanup.

### **Super Admin (System Owner)**
- **Permissions:** Unrestricted.
- **Rules:** Can delete any user from any domain at any time, regardless of their plan or account age.
- **Message:** `"Super Admin: User account and all associated data have been deleted successfully."`

### **Tenant Admin (Workspace Owner)**
- **Rules:**
  - **Domain Lock:** Can ONLY manage users from their own assigned domain.
  - **Paid Plan Lock:** Cannot delete any user if a paid plan has been assigned (manual assignment by Super Admin).
  - **Deletion Window:** Can only delete "Trial" users within **9 Days** of account creation.
- **Expired Window Message:** `"Action Denied: The 9-day deletion window for this trial user has expired. Please contact Support or the Super Admin to request deletion."`

---

## 3. 🚫 Ban & Unlock (Super Admin Panel)
The user status synchronization has been fixed.

- **Status Logic:** The "Active/Inactive" status is now dynamically read from the `plan_status` in the DB and reflects the real Supabase Auth ban state.
- **Blocking:** When blocked, a user is banned in Supabase Auth (Native) and marked as `suspended` in the DB.
- **Unblocking:** Super Admins now see a prominent green **"Unblock"** button for inactive users. Clicking this lifts the ban in Auth and restores access.
- **Security:** "Login" (Impersonation) is automatically disabled for blocked users.

---

## 4. 📊 Recent Signups & Trial List
A dedicated workspace for Tenant Admins to evaluate new users has been added.

- **"Recent Signups / Trial" Tab:** Highlights entries created within the last 9 days.
- **Highlights:** Trial users are marked with an amber avatar and a bold **"TRIAL"** badge.
- **Countdown Badge:** Displays a live countdown: **"Can delete for X more days"** so admins know their window of opportunity for cleanup.

---

## ⚙️ Configuration Guide

### **A. Local Dev / Deployment (CSV)**
You can now set these values per domain in `domains.csv`:
| Column | Default | Description |
|---|---|---|
| `TrialDays` | 7 | Days for the initial trial plan. |
| `DeleteWindowDays` | 9 | Days a Tenant Admin is allowed to delete the user. |

### **B. Server Environment (.env)**
The system uses these environment variables:
```env
TRIAL_DAYS=7
TENANT_ADMIN_DELETE_WINDOW_DAYS=9
```

---

## 📝 Maintenance Tasks
When updates are deployed, ensure the **Migration 211** (located in `server/sql/211_add_trial_period_and_delete_rules.sql`) is executed in the Supabase SQL Editor to update the database schema and triggers.
