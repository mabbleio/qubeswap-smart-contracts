import { ethers, network } from "hardhat";
import { parseEther } from "ethers/lib/utils";
import config from "../../config";

const currentNetwork = network.name;

const main = async () => {
  console.log("Deploying to network:", currentNetwork);

  const _totalSupplyDistributed = 600;
  const _qstPerBurn = parseEther("10");
  const _baseURI = "ipfs://";
  const _ipfsHash = "";
  const _endBlockTime = "";

  const BunnyMintingFarm = await ethers.getContractFactory("BunnyMintingFarm");

  const bunnyMintingFarm = await BunnyMintingFarm.deploy(
    config.QubeSwapToken[currentNetwork],
    _totalSupplyDistributed,
    _qstPerBurn,
    _baseURI,
    _ipfsHash,
    _endBlockTime
  );

  await bunnyMintingFarm.deployed();
  console.log("BunnyMintingFarm deployed to:", bunnyMintingFarm.address);

  const qubeBunniesAddress = await bunnyMintingFarm.qubeBunnies();
  console.log("QubeBunnies deployed to:", qubeBunniesAddress);
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
