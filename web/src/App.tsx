import { useEffect, useMemo, useRef, useState } from 'react';
import { usePrivy, useWallets, getAccessToken } from '@privy-io/react-auth';
import { Contract, formatUnits } from 'ethers';
import { ASSETS, CONFIG, type AssetKey } from './config';
import { buildSignedBuyOrder, createAuthedClobClient, submitOrderViaBackend } from './lib/clob';
import { countdown, fmtUsd, loadMarkets, loadSpot, shortAddr, type MarketRow } from './lib/markets';

type PickSide = { assetKey: AssetKey; isUp: boolean };
type HistoryItem = { asset: string; up: boolean; usd: number; price: number; ts: number; orderId?: string };

const ERC20_ABI = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'];

export default function App() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();
  const wallet = useMemo(() => wallets.find((w) => w.walletClientType === 'privy') || wallets[0], [wallets]);

  const [markets, setMarkets] = useState<Record<string, MarketRow | null>>({});
  const [spot, setSpot] = useState<Record<string, { price: number; changePct: number }>>({});
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const [balance, setBalance] = useState<number | null>(null);
  const [pick, setPick] = useState<PickSide | null>(null);
  const [usd, setUsd] = useState(String(CONFIG.DEFAULT_USD));
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const toastRef = useRef<number | null>(null);

  function showToast(msg: string, ms = 5000) {
    setToast(msg);
    if (toastRef.current) window.clearTimeout(toastRef.current);
    toastRef.current = window.setTimeout(() => setToast(''), ms);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      const [m, s] = await Promise.all([loadMarkets(), loadSpot()]);
      if (alive) {
        setMarkets(m);
        setSpot(s);
      }
    })();
    const mTimer = window.setInterval(async () => {
      setMarkets(await loadMarkets());
    }, 30000);
    const sTimer = window.setInterval(async () => {
      setSpot(await loadSpot());
    }, 10000);
    const cTimer = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => {
      alive = false;
      window.clearInterval(mTimer);
      window.clearInterval(sTimer);
      window.clearInterval(cTimer);
    };
  }, []);

  useEffect(() => {
    if (!authenticated || !wallet) {
      setBalance(null);
      return;
    }
    let alive = true;
    (async () => {
      try {
        await wallet.switchChain(137);
        const provider = await wallet.getEthereumProvider();
        const { BrowserProvider, Contract: C } = await import('ethers');
        const bp = new BrowserProvider(provider);
        const signer = await bp.getSigner();
        const pusd = new C(CONFIG.PUSD, ERC20_ABI, signer);
        const [raw, dec] = await Promise.all([pusd.balanceOf(wallet.address), pusd.decimals()]);
        if (alive) setBalance(Number(formatUnits(raw, dec)));
      } catch {
        if (alive) setBalance(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [authenticated, wallet]);

  async function placeBet() {
    if (!pick || !wallet) return;
    const market = markets[pick.assetKey];
    const usdNum = parseFloat(usd) || 0;
    if (!market) return showToast('市场数据加载中，请稍后再试');
    if (usdNum <= 0) return showToast('请输入金额');
    if (!CONFIG.BACKEND_URL) return showToast('未配置 BACKEND_URL');

    const tokenId = pick.isUp ? market.tokenUp : market.tokenDown;
    const price = pick.isUp ? market.pUp : market.pDown;
    if (!price || price <= 0) return showToast('当前价格不可用');

    setBusy(true);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error('无法获取登录凭证，请重新登录');

      const provider = await wallet.getEthereumProvider();
      const { client, creds } = await createAuthedClobClient(provider, wallet.address);
      const { signedOrder, price: px, size } = await buildSignedBuyOrder({
        client,
        tokenId,
        price,
        sizeUsd: usdNum,
      });

      const result = await submitOrderViaBackend({
        accessToken,
        signedOrder,
        tokenId,
        apiCreds: creds,
      });

      setHistory((prev) => [
        {
          asset: pick.assetKey,
          up: pick.isUp,
          usd: usdNum,
          price: px,
          ts: Date.now(),
          orderId: result.orderID,
        },
        ...prev,
      ]);
      showToast(`下单成功 · 约 ${size.toFixed(2)} 份 @ ${px.toFixed(2)} · ID ${result.orderID || 'pending'}`);
      setPick(null);
    } catch (e: any) {
      showToast(`失败: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  const active = pick ? markets[pick.assetKey] : null;
  const activePrice = pick && active ? (pick.isUp ? active.pUp : active.pDown) : 0;
  const estShares = activePrice > 0 ? (parseFloat(usd) || 0) / activePrice : 0;
  const estFee = ((parseFloat(usd) || 0) * CONFIG.BUILDER_TAKER_BPS) / 10000;

  return (
    <>
      <div className="topbar">
        <div className="wrap" style={{ paddingTop: 11, paddingBottom: 11 }}>
          <div className="flex items-center justify-between">
            <div className="logo">
              <div className="logo-mark">🍻</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15.5 }}>WinOneDrink</div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: -1 }}>Polymarket · 5 分钟涨跌</div>
              </div>
            </div>
            {authenticated ? (
              <button className="btn btn-connect on" onClick={logout}>
                <span className="net-dot ok" /> {shortAddr(wallet?.address)}
              </button>
            ) : (
              <button className="btn btn-connect" onClick={login} disabled={!ready}>
                <span className="net-dot" /> {ready ? '登录 / 注册' : '加载中…'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="wrap">
        <div className="hero-line">✨ 点一下，开心一整天 ✨</div>
        <div className="sub-line">
          {authenticated ? (
            <>
              余额 <b className="mono">{balance == null ? '…' : fmtUsd(balance)} pUSD</b>
              {' · '}
              {user?.email?.address || user?.google?.email || '已登录'}
              {balance != null && balance <= 0 ? ' · 需先充值 pUSD' : ''}
            </>
          ) : (
            '邮箱 / Google 一键登录，自动创建钱包 · 无需 App、无需助记词'
          )}
        </div>

        {ASSETS.map((asset) => {
          const m = markets[asset.key];
          const s = spot[asset.key];
          if (!m) {
            return (
              <div className="card" key={asset.key}>
                <div className="c-name">{asset.name}</div>
                <div className="c-stat">加载 5 分钟市场中…</div>
              </div>
            );
          }
          return (
            <div className="card" key={asset.key}>
              <div className="c-head">
                <div className="c-asset">
                  <div className="coin" style={{ background: asset.color }}>{asset.key[0]}</div>
                  <div>
                    <div className="c-name">{asset.name}</div>
                    <div className="c-stat">
                      Binance {fmtUsd(s?.price || 0, asset.dp)} · {s ? `${s.changePct >= 0 ? '+' : ''}${s.changePct.toFixed(2)}%` : '—'}
                      {' · '}剩余 {countdown(m.endTs, now)}
                    </div>
                  </div>
                </div>
              </div>
              <div className="btns">
                <button
                  className={`pick up ${pick?.assetKey === asset.key && pick.isUp ? 'active' : ''}`}
                  onClick={() => authenticated ? setPick({ assetKey: asset.key, isUp: true }) : login()}
                >
                  <div className="lbl">看涨 Up</div>
                  <div className="pct" style={{ color: 'var(--up)' }}>{Math.round(m.pUp * 100)}¢</div>
                </button>
                <button
                  className={`pick down ${pick?.assetKey === asset.key && !pick.isUp ? 'active' : ''}`}
                  onClick={() => authenticated ? setPick({ assetKey: asset.key, isUp: false }) : login()}
                >
                  <div className="lbl">看跌 Down</div>
                  <div className="pct" style={{ color: 'var(--down)' }}>{Math.round(m.pDown * 100)}¢</div>
                </button>
              </div>
            </div>
          );
        })}

        {history.length > 0 && (
          <div className="history">
            <h3>最近下单</h3>
            {history.slice(0, 5).map((h, i) => (
              <div className="h-item" key={i}>
                <span>{h.asset} {h.up ? 'Up' : 'Down'} · ${h.usd}</span>
                <span className="mono">{h.orderId ? h.orderId.slice(0, 10) + '…' : 'ok'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {pick && active && (
        <div className="sheet" onClick={() => !busy && setPick(null)}>
          <div className="sheet-inner" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 12 }}>
              {pick.assetKey} {pick.isUp ? '看涨 Up' : '看跌 Down'}
            </div>
            <input className="input" type="number" min="5" step="1" value={usd} onChange={(e) => setUsd(e.target.value)} />
            <div className="row"><span>当前价</span><span className="mono">{activePrice.toFixed(2)}</span></div>
            <div className="row"><span>预估份数</span><span className="mono">{estShares.toFixed(2)}</span></div>
            <div className="row"><span>平台费 (~1%)</span><span className="mono">${estFee.toFixed(2)}</span></div>
            <button className="btn-primary" disabled={busy} onClick={placeBet}>
              {busy ? '签名并提交中…' : `确认下注 $${usd}`}
            </button>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
