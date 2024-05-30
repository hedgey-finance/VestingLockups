require("@nomicfoundation/hardhat-ethers");
require('dotenv').config();
require('@nomicfoundation/hardhat-chai-matchers');
require('hardhat-gas-reporter');
require('@nomicfoundation/hardhat-verify');

module.exports = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: {
        enabled: true,
        runs: 100,
      },
      viaIR: true,
    },
  },
  gasReporter: {
    currency: 'USD',
    coinmarketcap: process.env.COINMARKETCAP,
    gasPriceApi: 'https://api.etherscan.io/api?module=proxy&action=eth_gasPrice',
    gasPrice: 40,
  },
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_URL,
      accounts: [process.env.TEST_DEPLOYER_PRIVATE_KEY, process.env.TOKEN_DEPLOYER],
    },
    mainnet: {
      url: process.env.MAINNET_URL,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY, process.env.TOKEN_DEPLOYER],
    },
  },
  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_APIKEY,
      mainnet: process.env.ETHERSCAN_APIKEY,
    },
  },
};
