# 💖 KupataLove — AI-Powered Dating App

A modern, full-stack dating application with:
- 🤖 **AI Matching** using OpenAI GPT-4o-mini
- 🌐 **Real-time Message Translation** via LibreTranslate
- 💬 **Live Chat** powered by Socket.IO
- 💳 **Subscriptions** via Stripe
- 🗄️ **MySQL on XAMPP** with Sequelize ORM
- 🌍 **20+ Languages** — UI loads in the user's chosen language
- 📱 **Responsive UI** — works on desktop and mobile

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ installed
- XAMPP running (MySQL on port 3306)
- Create a database called `kupatalove` in phpMyAdmin

### Installation

```bash
cd backend
npm install
```

### Configuration

The `.env` file is already created with XAMPP defaults. To enable premium features, edit `.env`:

```env
OPENAI_API_KEY=sk-your-actual-key-here
STRIPE_SECRET_KEY=sk_test_your-stripe-key
```

### Run the App

```bash
cd backend
npm run dev
```

Open your browser at: **http://localhost:5000**

The server will auto-create all MySQL tables on first run.

---

## 📁 Project Structure

```
kupatalove/
├── backend/
│   ├── src/
│   │   ├── config/        # Database config
│   │   ├── controllers/   # Route logic
│   │   ├── middleware/    # Auth, upload
│   │   ├── models/        # Sequelize models
│   │   ├── routes/        # API routes
│   │   ├── services/      # AI, translation, Stripe
│   │   └── sockets/       # Real-time chat
│   └── server.js
└── frontend/
    └── public/
        ├── index.html     # Landing page
        ├── auth.html      # Login/Register
        ├── app.html       # Main app
        ├── css/           # Styles
        ├── js/            # JavaScript
        └── locales/       # Translations
```

---

## 🔑 API Keys

| Service | How to get |
|---|---|
| OpenAI | [platform.openai.com](https://platform.openai.com) |
| Stripe | [dashboard.stripe.com](https://dashboard.stripe.com) |
| LibreTranslate | Free public API (no key needed) or [self-host](https://libretranslate.com) |

---

## 🌐 Translation

Messages are automatically translated using LibreTranslate. When User A (French) sends a message to User B (Spanish), the message is translated in real-time. The recipient sees a 🌐 badge and can tap to see the original.

---

## 💳 Subscription Plans

| Plan | Price | Features |
|---|---|---|
| Free | $0 | 10 likes/day, basic chat |
| Gold | $9.99/mo | Unlimited likes, see who liked you |
| Platinum | $19.99/mo | All Gold + AI boost, super likes |
