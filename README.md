# 📘 README: Solana DCA Bot with Jupiter API

This project allows you to **automatically DCA (Dollar Cost Average) excess SOL** into USDC using the [Jupiter Aggregator v6 API](https://docs.jup.ag/api-v6). It:

✅ Sells SOL over a **prudent reserve**  
✅ Swaps small **random amounts (0.1-0.2 SOL)**  
✅ Runs on a **random schedule (30-60 mins)**  
✅ Logs each sale and **transaction ID per wallet**  
✅ Runs as a **systemd background service**  
✅ Optional: Sends **Discord alerts** on swap success/failure

---

## 📂 Folder Structure

```
sol-dca/
├── src/
│   ├── index.ts                # Entrypoint (used by systemd)
│   └── startIncrementalSell.ts # Main DCA logic
├── wallets/
│   └── wallet1.json            # Secret key for your wallet (Uint8Array)
├── logs/
│   └── wallet1.log             # Logs swap events and TX IDs
├── package.json
├── tsconfig.json
```

---

## ✨ Getting Started

### 1. Clone & install

```bash
git clone <your-repo>
cd sol-dca
yarn install
```

---

### 2. Add your wallet

Store your secret key as a JSON file:

```bash
mkdir -p wallets
cp ~/path/to/your/solana-keypair.json wallets/wallet1.json
```

---

### 3. Compile

```bash
yarn build
```

---

### 4. Test locally

```bash
node dist/index.js
```

You should see logs in `logs/wallet1.log`. Every 30-60 min it will try to swap excess SOL.

---

## ⚙️ Setup systemd Service

### 1. Create a service file

```bash
sudo vim /etc/systemd/system/sol-dca-wallet1.service
```

Paste the following:

```ini
[Unit]
Description=SOL DCA Service for Wallet 1
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/sol-dca
ExecStart=/usr/bin/node dist/index.js
Environment=WALLET=./wallets/wallet1.json
Environment=PRUDENT_RESERVE=0.1
Restart=always
RestartSec=10
StandardOutput=append:/home/ubuntu/sol-dca/logs/wallet1.log
StandardError=append:/home/ubuntu/sol-dca/logs/wallet1.log

[Install]
WantedBy=multi-user.target
```

Update `User` and `WorkingDirectory` paths to match your setup.

---

### 2. Start & Enable the Service

```bash
sudo systemctl daemon-reload
sudo systemctl enable sol-dca-wallet1
sudo systemctl start sol-dca-wallet1
```

---

### 3. Monitor it

```bash
sudo systemctl status sol-dca-wallet1
tail -f logs/wallet1.log
```

---

## 🔔 Optional: Discord Webhook Alerts

### 1. Create a Webhook

Go to your Discord server → Settings → Integrations → Webhooks → Create Webhook  
Copy the webhook URL.

---

### 2. Add to `.env`

Create `.env` in the root:

```bash
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

Then update your `log()` function inside `startIncrementalSell.ts`:

```ts
import dotenv from 'dotenv';
dotenv.config();

const sendDiscordAlert = async (msg: string) => {
  const webhook = process.env.DISCORD_WEBHOOK_URL;

  if (!webhook || webhook.trim() === '') {
    return;
  }

  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: msg }),
    });
  } catch (e) {
    console.error('Discord alert failed:', (e as Error).message);
  }
};

const log = (msg: string) => {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(logPath, `[${timestamp}] ${msg}\n`);
  sendDiscordAlert(`[${wallet.publicKey.toBase58()}] ${msg}`);
};
```

---

## 🧪 Multi-Wallet Support

To add more wallets:

1. Add a new key: `wallets/wallet2.json`  
2. Duplicate the service file: `sol-dca-wallet2.service`  
3. Change:
   ```ini
   Environment=WALLET=./wallets/wallet2.json
   StandardOutput=append:/home/ubuntu/sol-dca/logs/wallet2.log
   ```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable sol-dca-wallet2
sudo systemctl start sol-dca-wallet2
```

---

## 🤖 Local Dev Commands

```bash
yarn build      # Transpile to dist/
yarn dev        # Run with ts-node (optional)
node dist/index.js # Run built service
```

---

## ✍️ License

MIT — feel free to fork and customize.

---