import React from 'react';
import { ethers } from 'ethers';
import Onboard from '@gnosis.pm/safe-apps-onboard';
import { CACHE_WALLET_KEY, INFURA_ID } from 'config';
import cache from 'utils/cache';
import NETWORKS from 'networks.json';
import REWARD_ESCROW_V2_ABI from 'abis/RewardEscrowV2.json';
import ISSUER_ABI from 'abis/Issuer.json';
import SYNTHETIX_BRIDGE_TO_OPTIMISM_ABI from 'abis/Synthetix.json';
import ERC20_ABI from 'abis/ERC20.json';

const DEFAULT_NETWORK_ID = 1;

const WALLETS = [
  { walletName: 'metamask', preferred: true },
  {
    walletName: 'walletConnect',
    infuraKey: INFURA_ID,
    preferred: true,
  },
  { walletName: 'gnosis' },
];

const WalletContext = React.createContext(null);

let onboard;

export function WalletProvider({ children }) {
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [address, setAddress] = React.useState(null);
  const [signer, setSigner] = React.useState(null);
  const [network, setNetwork] = React.useState('');

  const cfg = React.useMemo(() => {
    if (!network) return {};
    return NETWORKS[network] ?? {};
  }, [network]);

  const rewardEscrowV2Contract = React.useMemo(
    () =>
      signer &&
      cfg.rewardEscrowV2Address &&
      new ethers.Contract(
        cfg.rewardEscrowV2Address,
        REWARD_ESCROW_V2_ABI,
        signer
      ),
    [signer, cfg.rewardEscrowV2Address]
  );

  const issuerContract = React.useMemo(
    () =>
      signer &&
      cfg.issuerAddress &&
      new ethers.Contract(cfg.issuerAddress, ISSUER_ABI, signer),
    [signer, cfg.issuerAddress]
  );

  const synthetixContract = React.useMemo(
    () =>
      signer &&
      cfg.synthetixAddress &&
      new ethers.Contract(
        cfg.synthetixAddress,
        SYNTHETIX_BRIDGE_TO_OPTIMISM_ABI,
        signer
      ),
    [signer, cfg.synthetixAddress]
  );

  const sUSDContract = React.useMemo(
    () =>
      signer &&
      cfg.sUSDAddress &&
      new ethers.Contract(cfg.sUSDAddress, ERC20_ABI, signer),
    [signer, cfg.sUSDAddress]
  );

  const connect = React.useCallback(
    async tryCached => {
      if (address) return;

      let cachedWallet;
      if (tryCached) {
        cachedWallet = cache(CACHE_WALLET_KEY);
        if (!cachedWallet) return;
      }

      if (!onboard) {
        onboard = Onboard({
          networkId: await getDefaultNetworkId(),
          walletSelect: {
            wallets: WALLETS,
          },
        });
      }

      if (
        !(cachedWallet
          ? await onboard.walletSelect(cachedWallet)
          : await onboard.walletSelect())
      )
        return;
      await onboard.walletCheck();

      const {
        wallet: { name: walletName, provider: web3Provider },
      } = onboard.getState();

      if (~walletName.indexOf('MetaMask')) {
        cache(CACHE_WALLET_KEY, walletName);
      }

      web3Provider.on('accountsChanged', () => {
        window.location.reload();
      });
      web3Provider.on('chainChanged', () => {
        window.location.reload();
      });
      // web3Provider.on('disconnect', () => {
      //   disconnect();
      // });

      const provider = new ethers.providers.Web3Provider(web3Provider);
      const signer = provider.getSigner();

      setSigner(signer);
      setAddress(await signer.getAddress());
    },
    [address]
  );

  async function disconnect() {
    cache(CACHE_WALLET_KEY, null);
    setAddress(null);
    setSigner(null);
  }

  React.useEffect(() => {
    if (!signer) return;
    let isMounted = true;
    (async () => {
      const net = await signer.provider.getNetwork();
      if (isMounted) {
        setNetwork(~['homestead'].indexOf(net.name) ? 'mainnet' : net.name);
      }
    })();
    return () => (isMounted = false);
  }, [signer]);

  React.useEffect(() => {
    let isMounted = true;
    (async () => {
      await connect(true);
      if (isMounted) setIsLoaded(true);
    })();
    return () => (isMounted = false);
  }, [connect]);

  return (
    <WalletContext.Provider
      value={{
        isLoaded,
        address,
        connect,
        disconnect,
        config: cfg,
        network,
        signer,
        rewardEscrowV2Contract,
        issuerContract,
        synthetixContract,
        sUSDContract,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = React.useContext(WalletContext);
  if (!context) {
    throw new Error('Missing wallet context');
  }
  const {
    isLoaded,
    address,
    connect,
    disconnect,
    config,
    network,
    signer,
    rewardEscrowV2Contract,
    issuerContract,
    synthetixContract,
    sUSDContract,
  } = context;

  return {
    isLoaded,
    address,
    connect,
    disconnect,
    config,
    network,
    signer,
    availableNetworkNames: Object.keys(NETWORKS),
    rewardEscrowV2Contract,
    issuerContract,
    synthetixContract,
    sUSDContract,
  };
}

// https://github.com/Synthetixio/staking/blob/c42ac534ba774d83caca183a52348c8b6260fcf4/utils/network.ts#L5
async function getDefaultNetworkId() {
  try {
    if (window?.web3?.eth?.net) {
      const networkId = await window.web3.eth.net.getId();
      return Number(networkId);
    } else if (window?.web3?.version?.network) {
      return Number(window?.web3.version.network);
    } else if (window?.ethereum?.networkVersion) {
      return Number(window?.ethereum?.networkVersion);
    }
    return DEFAULT_NETWORK_ID;
  } catch (e) {
    console.log(e);
    return DEFAULT_NETWORK_ID;
  }
}
