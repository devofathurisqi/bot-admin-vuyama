# Vuyama WhatsApp Customer Service Bot 🤖

AI-powered customer service chatbot untuk Vuyama yang melayani reseller mukena dan kerudung melalui WhatsApp.

**Powered by Google Gemini AI**

## 🚀 Fitur Utama

- ✅ **AI-Powered Responses** - Natural language menggunakan Google Gemini AI
- ✅ **WhatsApp Integration** - Bot langsung di WhatsApp menggunakan whatsapp-web.js
- ✅ **Excel Knowledge Base** - Product info, services, FAQ dikelola via Excel (vuyama_data.xlsx)
- ✅ **Context Aware** - Bot mengingat percakapan sebelumnya untuk flow yang natural
- ✅ **Chat History** - Simpan semua chat history untuk tracking
- ✅ **Escalation** - Auto-detect dan escalate ke human agent

## 📋 Prerequisites

- Node.js 18+
- npm/yarn
- Gemini API Key (Dapatkan di [Google AI Studio](https://aistudio.google.com/))
- WhatsApp account

## 🛠️ Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure .env
Buat file `.env` (copy dari `.env.example`) dan masukkan API Key Anda:
```env
GEMINI_API_KEY=AIzaSy...
GEMINI_MODEL=gemini-1.5-flash
```

### 3. Prepare Knowledge Base
Edit data Vuyama di folder `learn/vuyama_data.xlsx`. Anda bisa mengedit:
- **Company**: Info profil perusahaan
- **Products**: Daftar produk, harga, stok
- **Services**: Layanan yang tersedia
- **FAQ**: Tanya jawab umum

### 4. Run Bot
```bash
npm start
```

Bot akan:
1. ✅ Connect ke Gemini AI
2. 📱 Show WhatsApp QR code
3. 💬 Siap menerima pesan

## 💬 Scan QR & Start Testing

1. Bot akan menampilkan **QR code** di terminal
2. Buka **WhatsApp** → **Linked Devices** → **Link a Device**
3. Scan QR code tersebut
4. Bot siap di-test!

## 🧠 AI System

Bot menggunakan **Google Gemini 1.5 Flash**:
- Fast & intelligent responses
- Multilingual support (Indonesian focus)
- Context-aware conversation

### System Prompt
AI diberikan personality:
- Admin customer service Vuyama yang friendly & professional
- Gaya bahasa natural dengan emoji
- Menggunakan data dari Excel sebagai basis pengetahuan
- Escalation handling untuk masalah yang butuh admin manusia

## 📁 Project Structure

```
vuyama-bot/
├── src/
│   ├── bot.js                 # Main WhatsApp + AI integration
│   ├── index.js               # Entry point
│   ├── handlers/
│   │   └── messageHandler.js  # AI response generation + escalation check
│   ├── services/
│   │   ├── gemini.js          # Gemini API wrapper
│   │   ├── knowledge.js       # Excel knowledge base loader
│   │   └── history.js         # Chat & order history
│   └── utils/
│       ├── config.js          # Configuration
│       ├── logger.js          # Logging
│       └── storage.js         # JSON file storage for history
├── learn/
│   ├── vuyama_data.xlsx       # Knowledge base (Excel)
│   └── images/                # Product images
├── data/                      # Chat history & orders (auto-created)
├── .env                       # Configuration
├── package.json
└── README.md
```

## 📊 Data Files

Data history tersimpan secara lokal di folder `data/`:
- `conversations.json`: Semua pesan chat
- `orders.json`: Catatan pesanan
- `escalations.json`: Tiket eskalasi ke admin

## 📞 Support

**Issues?**
1. Cek log terminal untuk melihat error
2. Pastikan `GEMINI_API_KEY` di `.env` sudah benar
3. Pastikan file `vuyama_data.xlsx` tidak sedang dibuka oleh aplikasi lain (Excel) saat bot dijalankan

## 📄 License

Created for Vuyama 2026
