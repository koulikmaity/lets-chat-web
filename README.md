# Let's Chat — WhatsApp Web–style messenger

A full-stack **React + Firebase Authentication + MongoDB + Express + Socket.IO** messenger. The interface is independently designed and inspired by the layout of WhatsApp Web, rather than an exact reproduction.

## Features

- Firebase email/password sign-up and sign-in
- MongoDB user directory, one-to-one conversations and message history
- Real-time messages via Socket.IO; authorized room membership on both REST and sockets
- Presence, typing status, delivery/read indicators (read receipts on opening a chat)
- Search contacts and conversations, responsive desktop/mobile layout, light/dark themes
- Message pagination API (60 latest messages, optional `before` cursor)
- Firebase Admin token verification and rate-limited REST API

## Security: rotate credentials before setup

Credentials were pasted into a chat and **must be considered compromised**. Revoke/delete the exposed Firebase service-account key in Google Cloud IAM and create a new one. Rotate the MongoDB Atlas database-user password. Update Atlas network restrictions as appropriate. Do not commit secrets. The project intentionally does **not** include any shared secret values. Firebase web app config is public by design; private service-account keys are not.

## Setup

Prerequisites: Node.js 20+, npm, a MongoDB Atlas database, Firebase project with **Email/Password** Authentication enabled.

### 1. API

```sh
cd server
cp .env.example .env
npm install
npm run dev
```

Edit `server/.env` with your **newly rotated** MongoDB URI and Firebase Admin values. To create a new Firebase service-account key use Firebase console > Project settings > Service accounts > Generate new private key. Place its `project_id`, `client_email`, and `private_key` into the corresponding `.env` entries. **Never put the Admin key in `client/.env`.**

### 2. Web

```sh
cd client
cp .env.example .env
npm install
npm run dev
```

Fill `client/.env` from Firebase console > Project settings > General > Web app configuration. The `VITE_` prefix is required. Open http://localhost:5173 .

Register two users in separate browsers/incognito windows. Both accounts will appear in the directory once they've signed in and been synced to MongoDB.

## App API

- `POST /api/me` — sync the Firebase-authenticated account to MongoDB
- `GET /api/users?q=` — find registered/synced people
- `GET /api/conversations` — list your conversations
- `POST /api/conversations` — create/reuse a 1:1 conversation, JSON `{ "userId": "firebase-uid" }`
- `GET /api/conversations/:id/messages?before=ISO_DATE` — recent messages
- `POST /api/conversations/:id/messages` — send, JSON `{ "text": "Hello" }`
- `POST /api/conversations/:id/seen` — mark received messages as seen

All `/api` endpoints except `/api/health` require `Authorization: Bearer <Firebase ID token>`.

## Notes

- The app uses Firebase **Authentication**, not Firestore. MongoDB stores conversations and messages.
- This is a functional starter, not an audited production deployment. Messages are **not end-to-end encrypted**. Do not advertise them as such.
- File attachments, calls, group chats, push notifications, pagination UI, block/report, abuse controls, and full delivery acknowledgements are not implemented.
- Only authenticated members may read or send to a conversation; no client-provided sender identity is trusted.
- `VITE_API_URL` defaults to `http://localhost:3001` and `CLIENT_ORIGIN` defaults to `http://localhost:5173`.
