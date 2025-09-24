# Qube Contracts 🥞

This repo contains all the contracts used in QubeSwap. It is divided in independent projects where each of them contains its smart contracts, test environment and unique config files.

## Existing projects

| Project name                                                          | Description                                                                                                                | Solidity version(s)      |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| [BSC Library](./projects/bsc-library)                                 | Legacy implementation of BEP20/IBEP20/SafeBEP20. Not to be used for new contracts.                                         | 0.6.12                   |
| [Qst Vault](./projects/qst-vault)                                   | QST vault ("AutoPool") contract that allows auto-compounding for QST tokens.                                             | 0.6.12                   |
| [Exchange Protocol](./projects/exchange-protocol)                     | Based on Uniswap V2, it combines peripheral and core trading and liquidity protocols. It also adds new features like zaps. | 0.5.16 / 0.6.6 / 0.8.4   |
| [Farms and Pools](./projects/farms-pools)                             | Based on SushiSwap's MasterChef, it also includes stand-alone pools and pool deployer.                                     | 0.6.12                   |
| [Farm Auctions](./projects/farm-auctions)                             | System for community-based auctions for future QST farms.                                                                 | 0.8.4                    |
| [IFO](./projects/ifo)                                                 | Initial Farm Offerings.                                                                                                    | 0.6.12                   |
| [Lottery](./projects/lottery)                                         | V2 Lottery system for QST built using Chainlink's VRF.                                                                    | 0.8.4                    |
| [NFT Markets](./projects/nft-markets)                                 | NFT marketplace for ERC721 tokens.                                                                                         | 0.8.4                    |
| [Qube Squad](./projects/qube-squad)                             | Qube Squad NFT collection.                                                                                              | 0.8.4                    |
| [Predictions](./projects/predictions)                                 | Prediction protocol contract built using Chainlink's oracle.                                                               | 0.6.12 (v1) / 0.8.4 (v2) |
| [Profile, NFT, and Gamification](./projects/profile-nft-gamification) | Qube Bunnies NFT, NFT factories, and Profile system.                                                                    | 0.6.12                   |
| [SmartChef Factory](./projects/smartchef)                             | SmartChef (a.k.a. Syrup Pools) Factory                                                                                     | 0.6.12 (v1) / 0.8.4 (v2) |

## Create a new project

1 - Create a new folder inside `projects` <br/>
2 - Run `yarn init`

Commands inside the root `package.json` starting with `lerna` will run the corresponding command in each subproject.
