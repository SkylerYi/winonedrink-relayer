import React from 'react';
import ReactDOM from 'react-dom/client';
import { PrivyProvider } from '@privy-io/react-auth';
import { polygon } from 'viem/chains';
import App from './App';
import { CONFIG } from './config';
import { WalletProvider } from './providers/WalletProvider';
import './index.css';

const rootEl = document.getElementById('root')!;

if (!CONFIG.PRIVY_APP_ID || !CONFIG.BACKEND_URL || !CONFIG.BUILDER_CODE) {
  ReactDOM.createRoot(rootEl).render(
    <div style={{ padding: 24, fontFamily: 'sans-serif', color: '#fff', background: '#0f0e14', minHeight: '100vh' }}>
      <h2>WinOneDrink · 配置缺失</h2>
      <p>构建时缺少环境变量。请在 web/.env 填好 VITE_PRIVY_APP_ID、VITE_BACKEND_URL、VITE_POLY_BUILDER_CODE 后重新 npm run build。</p>
    </div>,
  );
} else {
  ReactDOM.createRoot(rootEl).render(
    <PrivyProvider
        appId={CONFIG.PRIVY_APP_ID}
        config={{
          // 仅邮箱登录；Google 需在 Privy Dashboard → Authentication → Socials 开启后才可加回
          loginMethods: ['email'],
          defaultChain: polygon,
          supportedChains: [polygon],
          embeddedWallets: {
            createOnLogin: 'all-users',
            requireUserPasswordOnCreate: false,
            showWalletUIs: true,
          },
          appearance: {
            theme: 'dark',
            walletList: [],
            showWalletLoginFirst: false,
            loginMessage: 'WinOneDrink · 邮箱登录即可开始',
          },
        }}
      >
        <WalletProvider>
          <App />
        </WalletProvider>
      </PrivyProvider>,
  );
}
