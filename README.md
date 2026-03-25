# ⚡ Nexus Chat — Real-Time Chat Application

A full-stack real-time messaging app built with **Python/Flask-SocketIO**, **React**, **MySQL**, and **JWT authentication**.

---

## 🏗️ Tech Stack

| Layer | Tech |
|---|---|
| Backend | Python, Flask, Flask-SocketIO, Flask-JWT-Extended, Flask-SQLAlchemy |
| Real-time | WebSockets via Socket.IO (eventlet) |
| Database | MySQL (SQLite for local dev) |
| Auth | JWT (access + refresh tokens) |
| Frontend | React 18, React Router v6, Socket.IO Client, Axios |
| Deployment | Render (backend), Vercel/Netlify (frontend) |

---

## 📁 Project Structure

```
chat-app/
├── backend/
│   ├── app/
│   │   ├── __init__.py          # App factory, extensions init
│   │   ├── config.py            # Dev/Prod config classes
│   │   ├── extensions.py        # SQLAlchemy instance
│   │   ├── models.py            # User, Room, Message, ReadReceipt, MessageReaction
│   │   ├── socket_events.py     # All Socket.IO event handlers
│   │   └── routes/
│   │       ├── auth.py          # /api/auth — register, login, refresh, me
│   │       ├── users.py         # /api/users — list, get, update profile
│   │       ├── rooms.py         # /api/rooms — CRUD, join, leave, unread counts
│   │       └── messages.py      # /api/messages — history, edit, delete, read, search
│   ├── run.py                   # Entry point
│   ├── Procfile                 # Render deployment
│   └── requirements.txt
│
└── frontend/
    ├── public/
    │   └── index.html
    └── src/
        ├── context/
        │   ├── AuthContext.jsx  # User auth state + login/register/logout
        │   ├── SocketContext.jsx # Socket.IO connection lifecycle
        │   └── ChatContext.jsx  # Rooms, messages, reactions, unread, notifications
        ├── hooks/
        │   └── useTyping.js     # Debounced typing indicator hook
        ├── pages/
        │   ├── Login.jsx / Register.jsx
        │   └── Chat.jsx         # Main layout + modals orchestration
        ├── components/chat/
        │   ├── Sidebar.jsx      # Room list, search, unread badges, user footer
        │   ├── ChatWindow.jsx   # Messages, date separators, emoji, search
        │   ├── MessageBubble.jsx # Message with reactions, links, images
        │   ├── NewChatModal.jsx  # Create DM or group room
        │   ├── EmojiPicker.jsx  # Built-in categorized emoji picker
        │   ├── ProfileModal.jsx # Edit bio, avatar settings
        │   ├── RoomInfoDrawer.jsx # Room members, add/leave
        │   ├── SearchOverlay.jsx # Search messages within a room
        │   └── KeyboardShortcuts.jsx # Shortcuts help modal
        ├── components/ui/
        │   └── ConnectionToast.jsx # Connection status notifications
        ├── utils/
        │   └── api.js           # Axios instance with JWT interceptors
        ├── App.js               # Router + providers
        └── index.css            # Global styles
```

---

## 🚀 Local Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- MySQL (or use SQLite default)

---

### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env — set SECRET_KEY, JWT_SECRET_KEY, DATABASE_URL

# Run database migrations
flask --app run:app db init
flask --app run:app db migrate -m "initial"
flask --app run:app db upgrade

# Start server
python run.py
# Server runs at http://localhost:5000
```

**SQLite (no MySQL needed for dev):**  
Leave `DATABASE_URL` unset in `.env` — the app falls back to `sqlite:///chatapp_dev.db` automatically.

---

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
# Create .env file:
echo "REACT_APP_API_URL=http://localhost:5000" > .env

# Start dev server
npm start
# App runs at http://localhost:3000
```

---

## 🔌 WebSocket Events

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `connect` | `{ token }` via auth | Authenticate and join rooms |
| `join_room` | `{ roomId }` | Subscribe to a room |
| `leave_room` | `{ roomId }` | Unsubscribe from a room |
| `send_message` | `{ roomId, content, replyToId? }` | Send a message |
| `edit_message` | `{ messageId, content }` | Edit own message |
| `delete_message` | `{ messageId }` | Soft-delete own message |
| `mark_read` | `{ messageId }` | Mark message as read |
| `add_reaction` | `{ messageId, emoji }` | Add emoji reaction |
| `remove_reaction` | `{ messageId, emoji }` | Remove emoji reaction |
| `typing_start` | `{ roomId }` | Start typing indicator |
| `typing_stop` | `{ roomId }` | Stop typing indicator |

### Server → Client

| Event | Payload | Description |
|---|---|---|
| `connected` | `{ userId }` | Confirmed auth |
| `new_message` | `Message` | New message in room |
| `message_updated` | `Message` | Edited/deleted message |
| `reaction_updated` | `Message` | Reaction added/removed |
| `user_online` | `{ userId, username }` | User came online |
| `user_offline` | `{ userId, lastSeen }` | User went offline |
| `user_typing` | `{ userId, username, roomId }` | Typing indicator |
| `user_stopped_typing` | `{ userId, roomId }` | Stopped typing |
| `read_receipt` | `{ messageId, userId, roomId }` | Message was read |

---

## 🔐 REST API

### Auth — `/api/auth`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/register` | ❌ | Register new user |
| POST | `/login` | ❌ | Login, get tokens |
| POST | `/refresh` | Refresh token | Refresh access token |
| GET | `/me` | ✅ | Get current user |

### Users — `/api/users`
| Method | Path | Description |
|---|---|---|
| GET | `/` | Search users (`?q=`) |
| GET | `/:id` | Get user profile |
| PATCH | `/me` | Update bio, avatar |

### Rooms — `/api/rooms`
| Method | Path | Description |
|---|---|---|
| GET | `/` | My rooms |
| POST | `/` | Create room or DM |
| GET | `/:id` | Get room details |
| POST | `/:id/members` | Add member to group |
| POST | `/:id/leave` | Leave room |

### Messages — `/api/messages`
| Method | Path | Description |
|---|---|---|
| GET | `/room/:id` | Message history (paginated) |
| GET | `/search?q=&roomId=` | Search messages in a room |
| PATCH | `/:id` | Edit message |
| DELETE | `/:id` | Soft-delete message |
| POST | `/:id/read` | Mark as read |

---

## ☁️ Deploy on Render

### Backend (Web Service)
1. Connect GitHub repo
2. **Root Directory:** `backend`
3. **Build Command:** `pip install -r requirements.txt`
4. **Start Command:** `gunicorn --worker-class eventlet -w 1 run:app`
5. **Environment Variables:**
   - `FLASK_ENV=production`
   - `SECRET_KEY=<strong-random-key>`
   - `JWT_SECRET_KEY=<strong-random-key>`
   - `DATABASE_URL=mysql+pymysql://...` (from Render MySQL addon)
   - `CORS_ORIGINS=https://your-frontend.vercel.app`

### Database (MySQL)
- Add a **Render MySQL** instance
- Copy the internal connection string to `DATABASE_URL`
- Run migrations: `flask --app run:app db upgrade`

### Frontend (Vercel / Netlify)
1. **Root Directory:** `frontend`
2. **Build Command:** `npm run build`
3. **Output Directory:** `build`
4. **Environment Variable:** `REACT_APP_API_URL=https://your-backend.onrender.com`

---

## ✨ Features

- ✅ Real-time messaging with WebSockets
- ✅ JWT authentication (access + refresh tokens)
- ✅ Private DMs and group chat rooms
- ✅ Persistent message history (MySQL/SQLite)
- ✅ Read receipts with delivery indicators
- ✅ Online/offline status with last seen
- ✅ Typing indicators (debounced)
- ✅ Reply to messages (threaded)
- ✅ Edit & soft-delete own messages
- ✅ **Emoji reactions on messages** (👍❤️😂😮😢🔥)
- ✅ **Built-in emoji picker** (categorized, searchable)
- ✅ **Unread message count badges** per room
- ✅ **Date separators** between messages
- ✅ **Auto-link detection** (URLs become clickable)
- ✅ **Inline image preview** for image URLs
- ✅ **Browser desktop notifications** (Notification API)
- ✅ **Notification sounds** (Web Audio API)
- ✅ **Scroll-to-bottom** floating button
- ✅ **Auto-resize textarea** input
- ✅ **Document title** unread count badge
- ✅ **Copy message** to clipboard
- ✅ **Profile settings** modal (edit bio, avatar)
- ✅ **Room info drawer** (members, add member, leave)
- ✅ **Message search** within conversations
- ✅ **Keyboard shortcuts** (Ctrl+K, Ctrl+N, ?)
- ✅ **Connection status toasts** (reconnecting/back online)
- ✅ User search
- ✅ Auto-scroll and load earlier messages (pagination)
- ✅ Responsive sidebar (collapses on mobile)
- ✅ Token auto-refresh on 401

---

## 🔧 Environment Variables Reference

### Backend `.env`
```env
FLASK_ENV=development
SECRET_KEY=change-me-in-production
JWT_SECRET_KEY=change-me-in-production
DATABASE_URL=mysql+pymysql://user:pass@host:3306/chatapp
CORS_ORIGINS=http://localhost:3000,https://yourapp.vercel.app
```

### Frontend `.env`
```env
REACT_APP_API_URL=http://localhost:5000
```
