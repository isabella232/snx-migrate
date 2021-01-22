require('dotenv').config();
const fs = require('fs');
const path = require('path');
// const ethers = require('ethers');
const fetch = require('node-fetch');

// const INFURA_ID = process.env.REACT_APP_INFURA_ID;

const NETWORKS = [
  'mainnet',
  'kovan',
  // 'rinkeby',
  // 'ropsten'
];

main().then(
  () => process.exit(),
  err => {
    console.error(err);
    process.exit(0 - 1);
  }
);

async function main() {
  const networks = await Promise.all(NETWORKS.map(getNetworkConfig));

  fs.writeFileSync(
    path.join(__dirname, `../src/networks.json`),
    JSON.stringify(
      networks.reduce((r, a, i) => {
        r[NETWORKS[i]] = a;
        return r;
      }, {}),
      null,
      2
    ),
    'utf8'
  );
}

async function getNetworkConfig(network) {
  // const infuraProvider = new ethers.providers.InfuraProvider(
  //   network,
  //   INFURA_ID
  // );

  const [
    rewardEscrowV2Address,
    issuerAddress,
    synthetixAddress,
    sUSDAddress,
  ] = await Promise.all(
    ['RewardEscrowV2', 'Issuer', 'Synthetix', 'ProxyERC20sUSD'].map(
      request.bind(null, network)
    )
  );

  const sUSDCurrency =
    '0x7355534400000000000000000000000000000000000000000000000000000000';

  const cfg = {
    rewardEscrowV2Address,
    issuerAddress,
    sUSDCurrency,
    synthetixAddress,
    sUSDAddress,
  };

  return cfg;
}

async function request(network, contractName) {
  const res = await fetch(
    `https://contracts.synthetix.io/${
      network === 'mainnet' ? '' : `${network}/`
    }${contractName}`,
    {
      redirect: 'manual',
    }
  );
  return res.headers
    .get('location')
    .replace(
      `https://${
        network === 'mainnet' ? '' : `${network}.`
      }etherscan.io/address/`,
      ''
    );
}
