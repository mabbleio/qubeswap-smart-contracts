import type { HardhatUserConfig, NetworkUserConfig } from "hardhat/types";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-web3";
import "@nomiclabs/hardhat-truffle5";
import "@nomiclabs/hardhat-etherscan";
import "hardhat-abi-exporter";
import "hardhat-contract-sizer";
import "solidity-coverage";
import "dotenv/config";

const bscTestnet: NetworkUserConfig = {
  url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
  chainId: 97,
  accounts: [process.env.KEY_TESTNET!],
};

const bscMainnet: NetworkUserConfig = {
  url: "https://bsc-dataseed.binance.org/",
  chainId: 56,
  accounts: [process.env.KEY_MAINNET!],
};

const ticsMainnet: NetworkUserConfig = {
  url: 'https://rpc.qubetics.com/',
  chainId: 9030,
  accounts: [process.env.KEY_MAINNET!],
};

const { KEY_MAINNET } = process.env;

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      // Hardhat network configuration is for local development.
      // It can be forked to mirror a live network for testing.
    },
//    mainnet: {
//      url: "https://bsc-dataseed.binance.org/", // bscMainnet
//	  	chainId: 56,
//      accounts: [process.env.KEY_MAINNET!],
//    },
    mainnet: {
      url: "https://rpc.qubetics.com/",		// ticsMainnet
	  accounts: process.env.KEY_MAINNET
        ? [process.env.KEY_MAINNET]
        : [], // Safely handle the private key
      chainId: 9030,
	//  chainId: 9030,
    //  accounts: [process.env.KEY_MAINNET!],
    },
  },
  etherscan: {
    // API key is not always required for custom explorers but good practice to include
    apiKey: {
      mainnet: 'YOUR_API_KEY', // Replace with your TicsScan API key if needed
    },
    customChains: [
      {
        network: 'mainnet',
        chainId: 9030,
        urls: {
          apiURL: 'https://ticsscan.com/contract/verify', // TicsScan API URL
          browserURL: 'https://ticsscan.com/', // TicsScan browser URL
        },
      },
    ],
  },
  solidity: {
    compilers: [
      {
        version: "0.8.10",
        settings: {
          optimizer: {
            enabled: true,
            runs: 100,
          },
        },
      },
      {
        version: "0.8.9",
        settings: {
          optimizer: {
            enabled: true,
            runs: 100,
          },
        },
      },
      {
        version: "0.8.0",
        settings: {
          optimizer: {
            enabled: true,
            runs: 100,
          },
        },
      },
      {
        version: "0.6.12",
        settings: {
          optimizer: {
            enabled: true,
            runs: 100,
          },
        },
      },
    ],
  },
  paths: {
    sources: "./contracts/",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  // abiExporter: {
  //   path: "./data/abi",
  //   clear: true,
  //   flat: false,
  // },
};

export default config;
