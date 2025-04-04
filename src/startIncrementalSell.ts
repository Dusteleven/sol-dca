import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  VersionedTransaction,
} from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
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

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

// Jupiter endpoints
const JUPITER_QUOTE_URL = 'https://quote-api.jup.ag/v6/quote';
const JUPITER_SWAP_URL = 'https://quote-api.jup.ag/v6/swap';

// Mints
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

async function waitForConfirmation(
  connection: Connection,
  signature: string,
  maxWaitMs = 60_000, // 1 minute timeout
  pollInterval = 2_000
): Promise<boolean> {
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    const { value } = await connection.getSignatureStatuses([signature]);

    const status = value[0];
    if (
      status?.confirmationStatus === 'confirmed' ||
      status?.confirmationStatus === 'finalized'
    ) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error(
    `Transaction ${signature} not confirmed within ${maxWaitMs / 1000}s`
  );
}

export async function startIncrementalSell({
  connection,
  wallet,
  prudentReserveSOL = 0.1,
}: {
  connection: Connection;
  wallet: Keypair;
  prudentReserveSOL: number;
}) {
  const logPath = path.resolve(
    __dirname,
    `../logs/${wallet.publicKey.toBase58()}.log`
  );
  const log = (msg: string) => {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logPath, `[${timestamp}] ${msg}\n`);
    sendDiscordAlert(`[${wallet.publicKey.toBase58()}] ${msg}`);
    console.log(`[${timestamp}] ${msg}`);
  };

  while (true) {
    try {
      const balance = await connection.getBalance(wallet.publicKey);
      const reserveLamports = prudentReserveSOL * LAMPORTS_PER_SOL;
      const excessLamports = balance - reserveLamports;

      if (excessLamports < 0.1 * LAMPORTS_PER_SOL) {
        log(`💤 No excess SOL. Retrying in 15 minutes.`);
        await sleep(15 * 60 * 1000);
        continue;
      }

      const randomSellSOL = Math.min(
        randomInRange(0.1, 0.2),
        excessLamports / LAMPORTS_PER_SOL
      );
      const sellAmountLamports = Math.floor(randomSellSOL * LAMPORTS_PER_SOL);

      log(`🟢 Attempting to sell ${randomSellSOL.toFixed(9)} SOL`);

      // 1. Quote
      const quoteRes = await fetch(
        `${JUPITER_QUOTE_URL}?inputMint=${SOL_MINT}&outputMint=${USDC_MINT}&amount=${sellAmountLamports}&slippageBps=50&restrictIntermediateTokens=true`
      );
      const quoteData = await quoteRes.json();

      if (!quoteData?.routes?.[0]) {
        log(`⚠️ No route found for ${randomSellSOL.toFixed(9)} SOL`);
        await sleep(5 * 60 * 1000);
        continue;
      }

      // 2. Swap
      const swapRes = await fetch(JUPITER_SWAP_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quoteResponse: quoteData,
          userPublicKey: wallet.publicKey.toBase58(),
          dynamicSlippage: true,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: {
            priorityLevelWithMaxLamports: {
              maxLamports: 1_000_000,
              priorityLevel: 'veryHigh',
            },
          },
        }),
      });

      const swapData = await swapRes.json();
      const txBase64 = swapData.swapTransaction;

      if (!txBase64) {
        log(`❌ No transaction returned from swap endpoint.`);
        continue;
      }

      const transaction = VersionedTransaction.deserialize(
        Buffer.from(txBase64, 'base64')
      );

      transaction.sign([wallet]);

      const rawTx = transaction.serialize();
      const txid = await connection.sendRawTransaction(rawTx, {
        skipPreflight: true,
      });

      try {
        await waitForConfirmation(connection, txid);
        log(`✅ Sold ${randomSellSOL.toFixed(9)} SOL → USDC | TX: ${txid}`);
      } catch (err) {
        log(`⚠️ Timeout waiting for TX: ${txid}`);
      }
    } catch (err: any) {
      log(`❌ Error occurred: ${err.message || err}`);
    }

    const waitMinutes = randomInRange(30, 60);
    log(`🕒 Waiting ${waitMinutes.toFixed(1)} minutes until next attempt`);
    await sleep(waitMinutes * 60 * 1000);
  }
}
