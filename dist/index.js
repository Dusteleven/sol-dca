import { Connection, Keypair } from '@solana/web3.js';
import { startIncrementalSell } from './startIncrementalSell';
import fs from 'fs';
const walletPath = process.env.WALLET || './wallets/wallet1.json';
const reserve = Number(process.env.PRUDENT_RESERVE || 0.1);
const keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf8'))));
const connection = new Connection('https://api.mainnet-beta.solana.com');
startIncrementalSell({
    connection,
    wallet: keypair,
    prudentReserveSOL: reserve,
});
