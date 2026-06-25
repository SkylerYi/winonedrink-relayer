import React from 'react';
import ReactDOM from 'react-dom/client';
import { PrivyProvider } from '@privy-io/react-auth';
import { polygon } from 'viem/chains';
import App from './App';
import { CONFIG } from './config';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PrivyProvider
      appId={CONFIG.PRIVY_APP_ID}
      config={{
        defaultChain: polygon,
        supportedChains: [polygon],
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
        appearance: {
          theme: 'dark',
        },
      }}
    >
      <App />
    </PrivyProvider>
  </React.StrictMode>,
);
