import { PrivyClient } from '@privy-io/server-auth';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.PRIVY_APP_ID || !process.env.PRIVY_APP_SECRET) {
  throw new Error('Missing PRIVY_APP_ID or PRIVY_APP_SECRET');
}

export const privy = new PrivyClient({
  appId: process.env.PRIVY_APP_ID,
  appSecret: process.env.PRIVY_APP_SECRET,
});

export async function verifyPrivyUser(accessToken: string) {
  try {
    const verifiedClaims = await privy.verifyAccessToken(accessToken);
    return verifiedClaims;
  } catch (error) {
    console.error('Privy token verification failed:', error);
    throw new Error('Invalid Privy access token');
  }
}
