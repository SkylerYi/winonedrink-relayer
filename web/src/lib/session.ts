export type TradingSession = {
  eoaAddress: string;
  safeAddress: string;
  isSafeDeployed: boolean;
  hasApiCredentials: boolean;
  hasApprovals: boolean;
  apiCredentials?: {
    key: string;
    secret: string;
    passphrase: string;
  };
  lastChecked: number;
};

export type SessionStep =
  | 'idle'
  | 'checking'
  | 'deploying'
  | 'credentials'
  | 'approvals'
  | 'complete';

const key = (address: string) => `winonedrink_session_${address.toLowerCase()}`;

export function loadSession(address: string): TradingSession | null {
  const raw = localStorage.getItem(key(address));
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as TradingSession;
    if (session.eoaAddress.toLowerCase() !== address.toLowerCase()) {
      clearSession(address);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function saveSession(address: string, session: TradingSession) {
  localStorage.setItem(key(address), JSON.stringify(session));
}

export function clearSession(address: string) {
  localStorage.removeItem(key(address));
}

export const STEP_LABELS: Record<SessionStep, string> = {
  idle: '未初始化',
  checking: '检查钱包…',
  deploying: '部署 Safe（免 gas）…',
  credentials: '创建交易凭证…',
  approvals: '授权 USDC（免 gas）…',
  complete: '就绪',
};
