import { useEffect, useRef, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { ASSETS, CONFIG, type AssetKey } from './config';
import { useDeposit, useSafeBalance } from './hooks/wallet';
import { useTradingSession } from './hooks/useTradingSession';
import { placeBuyOrder } from './lib/trading';
import { createRedeemTx } from './lib/redeem';
import { createRelayClient } from './lib/trading';
import { countdown, fmtUsd, loadMarkets, loadSpot, shortAddr, type MarketRow } from './lib/markets';
import { useWallet } from './providers/WalletProvider';

type PickSide = { assetKey: AssetKey; isUp: boolean };
type HistoryItem = {
  asset: string;
  up: boolean;
  usd: number;
  price: number;
  ts: number;
  orderId?: string;
  conditionId?: string;
};

export default function App() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { eoaAddress, ethersSigner, walletClient } = useWallet();
  const trading = useTradingSession();
  const { balance, refresh: refreshBalance } = useSafeBalance(trading.safeAddress);
  const { deposit } = useDeposit(refreshBalance);

  const [markets, setMarkets] = useState<Record<string, MarketRow | null>>({});
  const [spot, setSpot] = useState<Record<string, { price: number; changePct: number }>>({});
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
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
    const mTimer = window.setInterval(async () => setMarkets(await loadMarkets()), 30000);
    const sTimer = window.setInterval(async () => setSpot(await loadSpot()), 10000);
    const cTimer = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => {
      alive = false;
      window.clearInterval(mTimer);
      window.clearInterval(sTimer);
      window.clearInterval(cTimer);
    };
  }, []);

  async function handleSetup() {
    if (!trading.walletReady) {
      return showToast('钱包初始化中，请稍等 2 秒再试');
    }
    try {
      await trading.initialize();
      showToast('交易账户已就绪，可以充值下注');
      refreshBalance();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('Builder API credentials')) {
        showToast('后端未配置 Builder API Key，请联系管理员');
      } else {
        showToast(`初始化失败: ${msg}`);
      }
    }
  }

  async function handleDeposit() {
    if (!trading.safeAddress) return showToast('请先完成账户初始化');
    try {
      setBusy(true);
      await deposit(trading.safeAddress, '25');
      showToast('充值流程已打开，完成后余额会自动刷新');
    } catch (e: unknown) {
      showToast(`充值失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function placeBet() {
    if (!pick || !trading.clobClient) return;
    const market = markets[pick.assetKey];
    const usdNum = parseFloat(usd) || 0;
    if (!market) return showToast('市场数据加载中，请稍后再试');
    if (usdNum < 5) return showToast('Polymarket 最小下单约 $5');
    if (balance != null && balance < usdNum) return showToast('余额不足，请先充值 USDC');

    const tokenId = pick.isUp ? market.tokenUp : market.tokenDown;
    const price = pick.isUp ? market.pUp : market.pDown;
    if (!price || price <= 0) return showToast('当前价格不可用');

    setBusy(true);
    try {
      const { result, price: px, size } = await placeBuyOrder({
        client: trading.clobClient,
        tokenId,
        price,
        sizeUsd: usdNum,
      });

      setHistory((prev) => [
        {
          asset: pick.assetKey,
          up: pick.isUp,
          usd: usdNum,
          price: px,
          ts: Date.now(),
          orderId: result.orderID || (result as any).id,
          conditionId: market.conditionId,
        },
        ...prev,
      ]);
      showToast(`下单成功 · ${size.toFixed(2)} 份 @ ${px.toFixed(2)}`);
      setPick(null);
      refreshBalance();
    } catch (e: unknown) {
      showToast(`失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function redeemItem(item: HistoryItem) {
    if (!item.conditionId || !walletClient || !trading.safeAddress) return;
    const market = markets[item.asset];
    if (market && market.endTs > now) return showToast('市场尚未结算，请稍后再领取');

    setBusy(true);
    try {
      const relay = createRelayClient(walletClient!);
      const tx = createRedeemTx({
        conditionId: item.conditionId,
        outcomeIndex: item.up ? 0 : 1,
      });
      const response = await relay.execute([tx], `Redeem ${item.asset}`);
      await response.wait();
      showToast('领取成功，USDC 已回到账户');
      refreshBalance();
    } catch (e: unknown) {
      showToast(`领取失败: ${e instanceof Error ? e.message : String(e)}`);
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
              <div className="flex items-center" style={{ gap: 8 }}>
                <span className="btn btn-connect on" style={{ cursor: 'default', pointerEvents: 'none' }}>
                  <span className="net-dot ok" /> {shortAddr(eoaAddress)}
                </span>
                <button className="btn btn-sm" type="button" onClick={logout}>
                  退出
                </button>
              </div>
            ) : (
              <button className="btn btn-connect" onClick={login} disabled={!ready}>
                <span className="net-dot" /> {ready ? '邮箱登录' : '加载中…'}
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
              Safe 余额 <b className="mono">{balance == null ? '…' : fmtUsd(balance)} USDC</b>
              {' · '}
              {user?.email?.address || user?.google?.email || '已登录'}
            </>
          ) : (
            '邮箱一键登录 · 自动创建钱包 · 站内充值 · 无需 Polymarket.com'
          )}
          <span className="version-tag"> · v0.3</span>
        </div>

        {authenticated && !trading.ready && (
          <div className="notice-banner">
            登录成功！请先点下方 <b>「开通交易账户」</b>，完成后再充值 USDC 才能下注。
          </div>
        )}

        {authenticated && (
          <div className="session-card">
            {!trading.ready ? (
              <>
                <div className="session-title">第一步：开通交易账户（约 30 秒，全程免 gas）</div>
                <div className="session-desc">
                  部署 Polymarket Safe · 授权 USDC · {trading.busy ? trading.stepLabel : '点击开始'}
                </div>
                {trading.error && <div className="session-error">{trading.error}</div>}
                <button
                  className="btn-primary session-btn"
                  disabled={trading.busy || !trading.walletReady}
                  onClick={handleSetup}
                >
                  {trading.busy ? trading.stepLabel : trading.walletReady ? '开通交易账户' : '钱包初始化中…'}
                </button>
              </>
            ) : (
              <div className="flex items-center justify-between session-ready">
                <div>
                  <div className="session-title">✓ 交易账户就绪</div>
                  <div className="session-desc mono">{shortAddr(trading.safeAddress)}</div>
                </div>
                <div className="flex" style={{ gap: 8 }}>
                  <button className="btn" disabled={busy} onClick={handleDeposit}>
                    充值 USDC
                  </button>
                  <button className="btn" disabled={busy} onClick={() => trading.reset()}>
                    重置
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

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
                  disabled={!trading.ready}
                  onClick={() => {
                    if (!authenticated) return login();
                    if (!trading.ready) return showToast('请先开通交易账户，再下注');
                    setPick({ assetKey: asset.key, isUp: true });
                  }}
                >
                  <div className="lbl">看涨 Up</div>
                  <div className="pct" style={{ color: 'var(--up)' }}>{Math.round(m.pUp * 100)}¢</div>
                </button>
                <button
                  className={`pick down ${pick?.assetKey === asset.key && !pick.isUp ? 'active' : ''}`}
                  disabled={!trading.ready}
                  onClick={() => {
                    if (!authenticated) return login();
                    if (!trading.ready) return showToast('请先开通交易账户，再下注');
                    setPick({ assetKey: asset.key, isUp: false });
                  }}
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
            {history.slice(0, 5).map((h, i) => {
              const ended = markets[h.asset]?.endTs ? markets[h.asset]!.endTs <= now : false;
              return (
                <div className="h-item" key={i}>
                  <span>{h.asset} {h.up ? 'Up' : 'Down'} · ${h.usd}</span>
                  <span className="flex" style={{ gap: 8, alignItems: 'center' }}>
                    {ended && h.conditionId && (
                      <button className="btn btn-sm" disabled={busy} onClick={() => redeemItem(h)}>
                        领取
                      </button>
                    )}
                    <span className="mono">{h.orderId ? h.orderId.slice(0, 10) + '…' : 'ok'}</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {pick && active && (
        <div className="sheet" onClick={() => !busy && setPick(null)}>
          <div className="sheet-inner" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 12 }}>
              {pick.assetKey} {pick.isUp ? '看涨 Up' : '看跌 Down'}
            </div>
            <input className="input" type="number" min="5" step="1" value={usd} onChange={(e) => setUsd(e.target.value)} placeholder="最少 $5" />
            <div className="row"><span>当前价</span><span className="mono">{activePrice.toFixed(2)}</span></div>
            <div className="row"><span>预估份数</span><span className="mono">{estShares.toFixed(2)}</span></div>
            <div className="row"><span>平台费 (~1%)</span><span className="mono">${estFee.toFixed(2)}</span></div>
            <button className="btn-primary" disabled={busy || !trading.ready} onClick={placeBet}>
              {busy ? '签名并提交中…' : `确认下注 $${usd}`}
            </button>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
