# QuickSend Mobile

A React Native (Expo) money-sending app with full **ILP / Rafiki wallet integration**, converted from the `easy-send-money` web prototype.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | React Native + Expo 52 |
| Router | Expo Router (file-based) |
| Payments | Interledger Protocol (ILP) via Open Payments API |
| Auth | GNAP (Grant Negotiation and Authorization Protocol) |
| State | React Context + TanStack Query |
| Storage | expo-secure-store (tokens), MMKV (app state) |
| Biometrics | expo-local-authentication |
| UI | Custom design system (no third-party UI lib) |

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start dev server
npx expo start

# 3. Run on device
# iOS: Press 'i' or scan QR in Expo Go
# Android: Press 'a' or scan QR in Expo Go
```

The app runs in **demo mode** by default — fully functional with mock data, no ILP credentials needed.

---

## ILP / Rafiki Integration

### What is ILP?

The **Interledger Protocol (ILP)** is an open standard for sending payments across different ledgers and currencies. **Rafiki** is an open-source ILP node and wallet toolkit from Interledger Foundation.

QuickSend uses the **Open Payments API** (built on top of ILP/Rafiki) for all money movement.

### Architecture

```
QuickSend App
     │
     ├── rafikiService.ts          ← All ILP API calls live here
     │         │
     │         ├── resolveWalletAddress()   GET {walletAddress}
     │         ├── requestOutgoingPaymentGrant()  POST {authServer}/
     │         ├── continueGrant()          POST {continueUri}
     │         ├── createQuote()            POST {resourceServer}/quotes
     │         ├── createOutgoingPayment()  POST {resourceServer}/outgoing-payments
     │         ├── createIncomingPayment()  POST {resourceServer}/incoming-payments
     │         ├── getWalletBalance()       GET  {resourceServer}/accounts/balance
     │         └── sendMoney()             ← Full end-to-end flow
     │
     └── WalletContext.tsx         ← App-wide wallet state + demo fallback
```

### Payment Flow (step by step)

```
1.  User enters recipient + amount
2.  getQuote() → GET locked exchange rate + fee from Rafiki
3.  User reviews and confirms
4.  sendMoney() begins:
      a. resolveWalletAddress(recipient)   — verify recipient exists
      b. createIncomingPayment(recipient)  — create receiving slot
      c. createQuote(sender, recipient)    — lock in rate
      d. createOutgoingPayment(quoteId)    — execute payment
      e. pollPaymentUntilComplete()        — wait for ILP settlement
5.  Success screen with ILP payment ID
```

### Environment Variables

Create a `.env.local` file in the project root:

```env
# Your Rafiki Authorization Server
EXPO_PUBLIC_RAFIKI_AUTH_URL=https://auth.your-wallet.com

# Your Rafiki Resource Server (Open Payments)
EXPO_PUBLIC_RAFIKI_RESOURCE_URL=https://your-wallet.com

# Your app's wallet address (the "sender" account)
EXPO_PUBLIC_CLIENT_WALLET_ADDRESS=https://your-wallet.com/quicksend
```

### Getting a Testnet Wallet

**Option 1 — Interledger Testnet (recommended for dev)**
1. Go to https://rafiki.money
2. Create a free account
3. Your wallet address will look like: `https://ilp.rafiki.money/yourname`
4. Get an access token from the wallet dashboard
5. Set the env vars above

**Option 2 — Run Rafiki locally**
```bash
git clone https://github.com/interledger/rafiki
cd rafiki
pnpm install
pnpm run start
```
Default local URLs:
- Auth server: `http://localhost:3006`
- Resource server: `http://localhost:3002`

**Option 3 — Interledger Foundation Testnet**
- Auth: `https://auth.wallet.example.com`
- Resource: `https://wallet.example.com`
- Docs: https://openpayments.dev

### GNAP Grants

Rafiki uses **GNAP** (not OAuth) for authorization. Two grant types:

**Non-interactive** (auto-approved — used in dev/sandbox):
```json
POST /
{
  "access_token": { "access": [{ "type": "outgoing-payment", ... }] },
  "client": "https://your-wallet.com/quicksend"
}
→ Returns { "access_token": { "value": "TOKEN..." } }
```

**Interactive** (user must approve — used in production):
```json
→ Returns { "interact": { "redirect": "https://..." }, "continue": {...} }
```
The app opens the `redirect` URL in a browser, user approves, then you call `continueGrant()` with the `interact_ref`.

In Settings → ILP Wallet, you can paste a pre-obtained GNAP token directly.

---

## Screens

| Screen | Route | Description |
|---|---|---|
| Welcome | `/` | Animated onboarding slides |
| Onboarding | `/onboarding` | Account creation (2 steps) |
| Login | `/login` | Email/password + Face ID |
| Dashboard | `/dashboard` | Balance, quick actions, recent txs |
| Send Money | `/send` | Contacts, amount, ILP quote, confirm |
| Receive | `/receive` | QR code, share wallet address, ILP payment request |
| Voice | `/voice` | Voice command parser (send, balance, history) |
| Invest | `/invest` | Investment products including ILP yield pool |
| Transactions | `/transactions` | Full tx history (filterable) |
| Money In | `/money-in` | Incoming transactions |
| Sent Out | `/sent-out` | Outgoing transactions |
| Settings | `/settings` | ILP wallet connection, tokens, biometrics |

---

## Project Structure

```
quicksend-mobile/
├── app/                    # Expo Router file-based routes
│   ├── _layout.tsx         # Root layout (providers)
│   ├── index.tsx           # / → WelcomeScreen
│   ├── dashboard.tsx       # /dashboard
│   ├── send.tsx            # /send
│   ├── receive.tsx         # /receive
│   ├── voice.tsx           # /voice
│   ├── invest.tsx          # /invest
│   ├── transactions.tsx    # /transactions
│   ├── settings.tsx        # /settings
│   └── ...
├── src/
│   ├── screens/            # Screen components
│   ├── context/
│   │   └── WalletContext.tsx   # Global wallet state + ILP
│   ├── services/
│   │   └── rafikiService.ts    # Full ILP/Rafiki API client
│   └── utils/
│       └── theme.ts            # Design tokens
├── assets/                 # Icons, splash
├── app.json                # Expo config
└── babel.config.js
```

---

## Building for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure
eas build:configure

# Build iOS
eas build --platform ios

# Build Android
eas build --platform android
```

---

## Key Differences from Web Version

| Feature | Web (easy-send-money) | Mobile (quicksend-mobile) |
|---|---|---|
| Framework | React + Vite | React Native + Expo |
| Routing | react-router-dom | expo-router (file-based) |
| Styling | Tailwind CSS | StyleSheet API + theme tokens |
| Payments | Mock only | Real ILP via Rafiki |
| Auth | None | GNAP + expo-secure-store |
| Biometrics | None | Face ID / Fingerprint |
| Voice | Browser SpeechRecognition | Expo Speech (demo mode) |
| QR Code | None | Custom QR visual + share |

---

## Resources

- [Interledger Open Payments Spec](https://openpayments.dev)
- [Rafiki GitHub](https://github.com/interledger/rafiki)
- [GNAP Protocol](https://www.rfc-editor.org/rfc/rfc9635)
- [Expo Documentation](https://docs.expo.dev)
- [ILP Testnet Wallet](https://rafiki.money)
