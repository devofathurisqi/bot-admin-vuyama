# Vuyama WhatsApp Customer Service Bot & CRM Suite 🤖

AI-powered customer service chatbot and admin dashboard for Vuyama, designed to streamline reseller and dropshipper interactions, manage orders, and handle complaints.

**Powered by Google Gemini AI**

---

## 🚀 Key Features

* **Single-Model Orchestration**:
  * **Google Gemini** acts as both the background context analyzer (intent classification, memory summarization, and ambiguity gating) and the primary responder generating professional, natural customer-facing replies.
* **3-Day Sliding Conversational Memory**: Replaces buggy message-count limits. Gemini summarizes the history of the last 3 days to maintain context, while messages older than 3 days automatically expire from active memory.
* **1-Number Manual Override (Auto-Mute)**: If the human admin manually replies to a customer (via phone or dashboard live chat), the bot automatically blocks itself for that contact and sets their status to `WAITING_HUMAN` to prevent overlapping replies.
* **Dynamic PDF Generation**: Automatically compiles premium A4 PDFs (invoices, material comparisons, and reseller welcome guides) using Puppeteer and attaches them directly to WhatsApp.
* **Database Single Source of Truth**: Completely transitioned from Excel to PostgreSQL (via Knex.js) for company profile, products, services, reseller programs, and FAQs.
* **Fuzzy FAQ Matcher Bypass**: Bypasses local FAQ similarity matching if the query mentions active product name tokens to ensure product-specific queries go through the full RAG pipeline.

---

## 🛠️ Tech Stack

* **Backend**: Node.js, Express, Knex.js, PostgreSQL, Socket.io
* **WhatsApp client**: whatsapp-web.js (Puppeteer integration)
* **Frontend**: React (served via Express from `/dist`)
* **AI Orchestration**: Google Gemini API (`gemini-2.5-flash`)

---

## 📋 Prerequisites

* Node.js 18+
* PostgreSQL database
* Gemini API Key
* WhatsApp account for QR code pairing

---

## 🛠️ Setup & Run

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create a `.env` file from the example, providing your database connection string and API keys:
```env
NODE_ENV=development
BOT_NAME=Vumin
DATABASE_URL=postgresql://user:password@host:port/database
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
```

### 3. Database Setup
The database schema and tables are managed directly on the live Supabase PostgreSQL instance. Ensure the `.env` variables are correctly configured.

### 4. Run the Application
```bash
npm start
```
Scan the QR code displayed in the terminal with your WhatsApp app (**Linked Devices**) to connect.

---

## 📁 Project Structure

```
admin-bot-vuyama/
├── src/
│   ├── index.js               # Entry point
│   ├── bot.js                 # WhatsApp Web client & PDF send delegation
│   ├── server.js              # Express API & Socket.io server
│   ├── bot_state.js           # Shared bot connection state
│   ├── handlers/
│   │   └── messageHandler.js  # Single-model reply loop & auto-block routing
│   ├── services/
│   │   ├── gemini.js          # Gemini generative API wrapper
│   │   ├── analyzer.js        # Gemini intent & memory analyzer
│   │   ├── memory.js          # Conversation memory updater
│   │   ├── history.js         # Time-based 3-day history filter
│   │   ├── knowledge.js       # PostgreSQL RAG lookup & local FAQ similarity
│   │   └── documentGenerator.js # Real-time A4 PDF compiler (Puppeteer)
│   ├── utils/
│   │   ├── db.js              # Knex PostgreSQL connection
│   │   ├── logger.js          # Pino logger config
│   │   ├── socket.js          # WebSockets manager
│   │   └── workflow.js        # Workflow auto-pause utility
├── learn/                     # Storage for uploaded product images
├── data/
│   ├── media/                 # Daily color stock images
│   └── pdf/                   # Compiled A4 PDF documents
├── dist/                      # Dashboard UI React build
└── README.md
```
