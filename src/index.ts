import { Connection, Keypair } from '@solana/web3.js';
import { startIncrementalSell } from './startIncrementalSell';
import fs from 'fs';

const walletPath = process.env.WALLET || './wallets/wallet1.json';
const reserve = Number(process.env.PRUDENT_RESERVE || 0.1);
const waitMinMins = Number(process.env.MIN_MINS || 30);
const waitMaxMins = Number(process.env.MAX_MINS || 60);
const minSOL = Number(process.env.MIN_SOL || 0.1);
const maxSOL = Number(process.env.MAX_SOL || 0.2);

const keypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf8')))
);

const connection = new Connection('https://api.mainnet-beta.solana.com');

startIncrementalSell({
  connection,
  wallet: keypair,
  prudentReserveSOL: reserve,
  waitMinMins: waitMinMins,
  waitMaxMins: waitMaxMins,
  minSOL: minSOL,
  maxSOL: maxSOL
});
