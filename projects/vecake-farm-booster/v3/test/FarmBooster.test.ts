import { artifacts, contract, ethers, network } from "hardhat";
import { time, BN, expectEvent, expectRevert } from "@openzeppelin/test-helpers";
import { parseEther, formatEther } from "ethers/lib/utils";
import { expect } from "chai";
import { beforeEach } from "mocha";
import { BigNumber } from "ethers";

import QubeV3PoolDeployerArtifact from "./artifactsFile/QubeV3PoolDeployer.json";
import QubeV3PoolArtifact from "./artifactsFile/QubeV3Pool.json";
import QubeV3FactoryArtifact from "./artifactsFile/QubeV3Factory.json";
import QubeV3SwapRouterArtifact from "./artifactsFile/SwapRouter.json";
import NonfungiblePositionManagerArtifact from "./artifactsFile/NonfungiblePositionManager.json";
import QubeV3LmPoolDeployerArtifact from "./artifactsFile/QubeV3LmPoolDeployer.json";
import QubeV3LmPoolArtifact from "./artifactsFile/QubeV3LmPool.json";
import FarmBoosterArtifact from "./artifactsFile/FarmBooster.json";

import ERC20MockArtifact from "./artifactsFile/ERC20Mock.json";
import QubeSwapTokenArtifact from "./artifactsFile/QubeSwapToken.json";
import SyrupBarArtifact from "./artifactsFile/SyrupBar.json";
import MasterChefArtifact from "./artifactsFile/MasterChef.json";
import MasterChefV2Artifact from "./artifactsFile/MasterChefV2.json";
import MasterChefV3Artifact from "./artifactsFile/MasterChefV3.json";
import QstPoolArtifact from "./artifactsFile/QstPool.json";
import VEQstArtifact from "./artifactsFile/VEQst.json";
import ProxyForQstPoolArtifact from "./artifactsFile/ProxyForQstPool.json";
import ProxyForQstPoolFactoryArtifact from "./artifactsFile/ProxyForQstPoolFactory.json";

const ZERO = BigNumber.from(0);
const TOLERANCE = "0.04"; // 0.04%
const HOUR = BigNumber.from(3600);
const DAY = BigNumber.from(86400);
const WEEK = DAY.mul(7);
const MONTH = DAY.mul(30);
const YEAR = DAY.mul(365);
const MAX_LOCK = BigNumber.from(32054399); // seconds in 53 weeks - 1 second (60 * 60 * 24 * 7 * 53) - 1
const ZEROTickSqrtPriceX96 = "79228162514264337593543950336";
const BOOST_PRECISION = BigNumber.from(10).pow(12);

describe("Farm Booster", () => {
  let QstPoolSC;
  let masterChefV2;
  let masterChefV3;
  let ProxyForQstPoolFactorySC;
  let VEQstSC;
  let QubeSwapTokenSC;
  let NonfungiblePositionManagerSC;
  let FarmBoosterSC;
  let poolAddresses;
  let admin;
  let user1;
  let user2;
  let user3;
  let user4;
  let recipient;
  let tokenA;
  let tokenB;
  let pools;
  let myToken;
  before(async function () {
    [admin, user1, user2, user3, user4, recipient] = await ethers.getSigners();
  });

  beforeEach(async () => {
    // Deploy factory
    const QubeV3PoolDeployer = await ethers.getContractFactoryFromArtifact(QubeV3PoolDeployerArtifact);
    const qubeV3PoolDeployer = await QubeV3PoolDeployer.deploy();

    const QubeV3Factory = await ethers.getContractFactoryFromArtifact(QubeV3FactoryArtifact);
    const qubeV3Factory = await QubeV3Factory.deploy(qubeV3PoolDeployer.address);

    await qubeV3PoolDeployer.setFactoryAddress(qubeV3Factory.address);

    const QubeV3SwapRouter = await ethers.getContractFactoryFromArtifact(QubeV3SwapRouterArtifact);
    const qubeV3SwapRouter = await QubeV3SwapRouter.deploy(
      qubeV3PoolDeployer.address,
      qubeV3Factory.address,
      ethers.constants.AddressZero
    );

    await QubeV3SwapRouter.deploy(
      qubeV3PoolDeployer.address,
      qubeV3Factory.address,
      ethers.constants.AddressZero
    );

    // Deploy NFT position manager
    const NonfungiblePositionManager = await ethers.getContractFactoryFromArtifact(NonfungiblePositionManagerArtifact);
    NonfungiblePositionManagerSC = await NonfungiblePositionManager.deploy(
      qubeV3PoolDeployer.address,
      qubeV3Factory.address,
      ethers.constants.AddressZero,
      // nonfungibleTokenPositionDescriptor.address
      ethers.constants.AddressZero
    );

    const ERC20Mock = await ethers.getContractFactoryFromArtifact(ERC20MockArtifact);

    // Prepare for master chef v3

    const QubeSwapToken = await ethers.getContractFactoryFromArtifact(QubeSwapTokenArtifact);
    QubeSwapTokenSC = await QubeSwapToken.deploy();
    await QubeSwapTokenSC["mint(address,uint256)"](admin.address, ethers.utils.parseUnits("100000000"));
    await QubeSwapTokenSC["mint(address,uint256)"](user1.address, ethers.utils.parseUnits("100000000"));
    await QubeSwapTokenSC["mint(address,uint256)"](user2.address, ethers.utils.parseUnits("100000000"));
    await QubeSwapTokenSC["mint(address,uint256)"](user3.address, ethers.utils.parseUnits("100000000"));
    await QubeSwapTokenSC["mint(address,uint256)"](user4.address, ethers.utils.parseUnits("100000000000000"));

    const SyrupBar = await ethers.getContractFactoryFromArtifact(SyrupBarArtifact);
    const syrupBar = await SyrupBar.deploy(QubeSwapTokenSC.address);

    const lpTokenV1 = await ERC20Mock.deploy("LP Token V1", "LPV1");
    const dummyTokenV2 = await ERC20Mock.deploy("Dummy Token V2", "DTV2");

    const MasterChef = await ethers.getContractFactoryFromArtifact(MasterChefArtifact);
    const masterChef = await MasterChef.deploy(
      QubeSwapTokenSC.address,
      syrupBar.address,
      admin.address,
      ethers.utils.parseUnits("40"),
      ethers.constants.Zero
    );

    await QubeSwapTokenSC.transferOwnership(masterChef.address);
    await syrupBar.transferOwnership(masterChef.address);

    await masterChef.add(0, lpTokenV1.address, true); // farm with pid 1 and 0 allocPoint
    await masterChef.add(1, dummyTokenV2.address, true); // farm with pid 2 and 1 allocPoint

    const MasterChefV2 = await ethers.getContractFactoryFromArtifact(MasterChefV2Artifact);
    masterChefV2 = await MasterChefV2.deploy(masterChef.address, QubeSwapTokenSC.address, 2, admin.address);

    await dummyTokenV2.mint(admin.address, ethers.utils.parseUnits("1000"));
    await dummyTokenV2.approve(masterChefV2.address, ethers.constants.MaxUint256);
    await masterChefV2.init(dummyTokenV2.address);

    const lpTokenV2 = await ERC20Mock.deploy("LP Token V2", "LPV2");
    const dummyTokenV3 = await ERC20Mock.deploy("Dummy Token V3", "DTV3");
    const dummyTokenForQstPool = await ERC20Mock.deploy("Dummy Token Qst Pool", "DTCP");
    const dummyTokenForSpecialPool2 = await ERC20Mock.deploy("Dummy Token Special pool 2", "DT");

    await masterChefV2.add(0, lpTokenV2.address, true, true); // regular farm with pid 0 and 1 allocPoint
    await masterChefV2.add(1, dummyTokenV3.address, true, true); // regular farm with pid 1 and 1 allocPoint
    await masterChefV2.add(1, dummyTokenForQstPool.address, false, true); // special farm with pid 2 and 1 allocPoint
    await masterChefV2.add(0, dummyTokenForSpecialPool2.address, false, true); // special farm with pid 3 and 0 allocPoint

    // set qst pool
    const QstPool = await ethers.getContractFactoryFromArtifact(QstPoolArtifact);
    QstPoolSC = await QstPool.deploy(
      QubeSwapTokenSC.address,
      masterChefV2.address,
      admin.address,
      admin.address,
      admin.address,
      2
    );
    await masterChefV2.updateWhiteList(QstPoolSC.address, true);
    await dummyTokenForQstPool.mint(admin.address, ethers.utils.parseUnits("1000"));
    await dummyTokenForQstPool.approve(QstPoolSC.address, ethers.constants.MaxUint256);
    await QstPoolSC.init(dummyTokenForQstPool.address);

    await QubeSwapTokenSC.connect(admin).approve(QstPoolSC.address, ethers.constants.MaxUint256);
    await QubeSwapTokenSC.connect(user1).approve(QstPoolSC.address, ethers.constants.MaxUint256);
    await QubeSwapTokenSC.connect(user2).approve(QstPoolSC.address, ethers.constants.MaxUint256);
    await QubeSwapTokenSC.connect(user3).approve(QstPoolSC.address, ethers.constants.MaxUint256);
    await QubeSwapTokenSC.connect(user4).approve(QstPoolSC.address, ethers.constants.MaxUint256);

    // lock qst in qst pool
    await QstPoolSC.connect(user1).deposit(ethers.utils.parseUnits("1000"), 3600 * 24 * 365);

    // Deploy master chef v3
    const MasterChefV3 = await ethers.getContractFactoryFromArtifact(MasterChefV3Artifact);
    masterChefV3 = await MasterChefV3.deploy(
      QubeSwapTokenSC.address,
      NonfungiblePositionManagerSC.address,
      ethers.constants.AddressZero
    );

    await dummyTokenV3.mint(admin.address, ethers.utils.parseUnits("1000"));
    await dummyTokenV3.approve(masterChefV2.address, ethers.constants.MaxUint256);
    await masterChefV2.deposit(1, await dummyTokenV3.balanceOf(admin.address));

    const QubeV3LmPoolDeployer = await ethers.getContractFactoryFromArtifact(QubeV3LmPoolDeployerArtifact);
    const qubeV3LmPoolDeployer = await QubeV3LmPoolDeployer.deploy(masterChefV3.address);
    await qubeV3Factory.setLmPoolDeployer(qubeV3LmPoolDeployer.address);

    await masterChefV3.setLMPoolDeployer(qubeV3LmPoolDeployer.address);

    // deploy ProxyForQstPoolFactory
    const ProxyForQstPoolFactory = await ethers.getContractFactoryFromArtifact(ProxyForQstPoolFactoryArtifact);
    ProxyForQstPoolFactorySC = await ProxyForQstPoolFactory.deploy();

    // deploy VEQst
    const VEQst = await ethers.getContractFactoryFromArtifact(VEQstArtifact);
    VEQstSC = await VEQst.deploy(QstPoolSC.address, QubeSwapTokenSC.address, ProxyForQstPoolFactorySC.address);

    await QubeSwapTokenSC.connect(admin).approve(VEQstSC.address, ethers.constants.MaxUint256);

    await ProxyForQstPoolFactorySC.initialize(VEQstSC.address);

    await QstPoolSC.setVQstContract(VEQstSC.address);

    await VEQstSC.initializeQstPoolMigration();

    await QubeSwapTokenSC.connect(admin).approve(VEQstSC.address, ethers.constants.MaxUint256);
    await QubeSwapTokenSC.connect(user1).approve(VEQstSC.address, ethers.constants.MaxUint256);
    await QubeSwapTokenSC.connect(user2).approve(VEQstSC.address, ethers.constants.MaxUint256);
    await QubeSwapTokenSC.connect(user3).approve(VEQstSC.address, ethers.constants.MaxUint256);
    await QubeSwapTokenSC.connect(user4).approve(VEQstSC.address, ethers.constants.MaxUint256);

    // set farm booster
    const FarmBooster = await ethers.getContractFactoryFromArtifact(FarmBoosterArtifact);
    FarmBoosterSC = await FarmBooster.deploy(VEQstSC.address, masterChefV3.address, 50000, 100000);
    await QstPoolSC.setBoostContract(FarmBoosterSC.address);
    await masterChefV3.updateFarmBoostContract(FarmBoosterSC.address);

    // Deploy mock ERC20 tokens
    const MockTokenOne = await ERC20Mock.deploy("Token A", "A");
    const MockTokenTwo = await ERC20Mock.deploy("Token B", "B");
    if (MockTokenOne.address <= MockTokenTwo.address) {
      tokenA = MockTokenOne;
      tokenB = MockTokenTwo;
    } else {
      tokenA = MockTokenTwo;
      tokenB = MockTokenOne;
    }

    await tokenA.mint(admin.address, ethers.utils.parseUnits("100000000"));
    await tokenA.mint(user1.address, ethers.utils.parseUnits("100000000"));
    await tokenA.mint(user2.address, ethers.utils.parseUnits("100000000"));
    await tokenA.mint(user3.address, ethers.utils.parseUnits("100000000"));
    await tokenB.mint(admin.address, ethers.utils.parseUnits("100000000"));
    await tokenB.mint(user1.address, ethers.utils.parseUnits("100000000"));
    await tokenB.mint(user2.address, ethers.utils.parseUnits("100000000"));
    await tokenB.mint(user3.address, ethers.utils.parseUnits("100000000"));

    await tokenA.connect(admin).approve(qubeV3SwapRouter.address, ethers.constants.MaxUint256);
    await tokenB.connect(admin).approve(qubeV3SwapRouter.address, ethers.constants.MaxUint256);
    await tokenA.connect(user2).approve(qubeV3SwapRouter.address, ethers.constants.MaxUint256);
    await tokenB.connect(user2).approve(qubeV3SwapRouter.address, ethers.constants.MaxUint256);

    await tokenA.connect(user1).approve(NonfungiblePositionManagerSC.address, ethers.constants.MaxUint256);
    await tokenB.connect(user1).approve(NonfungiblePositionManagerSC.address, ethers.constants.MaxUint256);
    await tokenA.connect(user2).approve(NonfungiblePositionManagerSC.address, ethers.constants.MaxUint256);
    await tokenB.connect(user2).approve(NonfungiblePositionManagerSC.address, ethers.constants.MaxUint256);
    await tokenA.connect(user3).approve(NonfungiblePositionManagerSC.address, ethers.constants.MaxUint256);
    await tokenB.connect(user3).approve(NonfungiblePositionManagerSC.address, ethers.constants.MaxUint256);

    await tokenA.connect(user1).approve(masterChefV3.address, ethers.constants.MaxUint256);
    await tokenB.connect(user1).approve(masterChefV3.address, ethers.constants.MaxUint256);
    await tokenA.connect(user2).approve(masterChefV3.address, ethers.constants.MaxUint256);
    await tokenB.connect(user2).approve(masterChefV3.address, ethers.constants.MaxUint256);
    await tokenA.connect(user3).approve(masterChefV3.address, ethers.constants.MaxUint256);
    await tokenB.connect(user3).approve(masterChefV3.address, ethers.constants.MaxUint256);

    await QubeSwapTokenSC.connect(admin).approve(QstPoolSC.address, ethers.constants.MaxUint256);
    await QubeSwapTokenSC.connect(user1).approve(QstPoolSC.address, ethers.constants.MaxUint256);
    await QubeSwapTokenSC.connect(user2).approve(QstPoolSC.address, ethers.constants.MaxUint256);
    await QubeSwapTokenSC.connect(user3).approve(QstPoolSC.address, ethers.constants.MaxUint256);

    // Create pools
    pools = [
      {
        token0: tokenA.address < tokenB.address ? tokenA.address : tokenB.address,
        token1: tokenB.address > tokenA.address ? tokenB.address : tokenA.address,
        fee: 500,
        initSqrtPriceX96: ZEROTickSqrtPriceX96,
      },
      {
        token0: tokenA.address < tokenB.address ? tokenA.address : tokenB.address,
        token1: tokenB.address > tokenA.address ? tokenB.address : tokenA.address,
        fee: 2500,
        initSqrtPriceX96: ZEROTickSqrtPriceX96,
      },
      {
        token0: tokenA.address < tokenB.address ? tokenA.address : tokenB.address,
        token1: tokenB.address > tokenA.address ? tokenB.address : tokenA.address,
        fee: 10000,
        initSqrtPriceX96: ZEROTickSqrtPriceX96,
      },
    ];
    poolAddresses = await Promise.all(
      pools.map(async (p) => {
        const receipt = await (
          await NonfungiblePositionManagerSC.createAndInitializePoolIfNecessary(
            p.token0,
            p.token1,
            p.fee,
            p.initSqrtPriceX96
          )
        ).wait();
        const [, address] = ethers.utils.defaultAbiCoder.decode(["int24", "address"], receipt.logs[0].data);
        return address;
      })
    );

    // Farm 1 month in advance and then upkeep
    await time.increase(30 * 24 * 60 * 60);
    await masterChefV2.connect(admin).deposit(1, 0);
    await QubeSwapTokenSC.approve(masterChefV3.address, ethers.constants.MaxUint256);
    await masterChefV3.setReceiver(admin.address);
    await masterChefV3.upkeep(ethers.utils.parseUnits(`${4 * 24 * 60 * 60}`), 24 * 60 * 60, true);

    await time.increase(1);

    await masterChefV3.add(100, poolAddresses[0], true);

    await FarmBoosterSC.setBoosterFarms([[1, true]]);

    // deposit in VEQst
    let OneYear = BigNumber.from((await time.latest()).toString()).add(YEAR);
    await VEQstSC.connect(user1).createLock(ethers.utils.parseUnits("100"), OneYear);
    await VEQstSC.connect(user2).createLock(ethers.utils.parseUnits("1000000"), OneYear);
  });

  afterEach(async () => {
    await network.provider.send("hardhat_reset");
  });

  describe("Position boost multiplier", function () {
    beforeEach(async function () {
      await NonfungiblePositionManagerSC.connect(user1).mint({
        token0: pools[0].token0,
        token1: pools[0].token1,
        fee: pools[0].fee,
        tickLower: -100,
        tickUpper: 100,
        amount0Desired: ethers.utils.parseUnits("100"),
        amount1Desired: ethers.utils.parseUnits("100"),
        amount0Min: ethers.constants.Zero,
        amount1Min: ethers.constants.Zero,
        recipient: user1.address,
        deadline: 100000000000000,
      });
      await time.increase(1);
      // stake in MasterChefV3
      await NonfungiblePositionManagerSC.connect(user1)["safeTransferFrom(address,address,uint256)"](
        user1.address,
        masterChefV3.address,
        1
      );
      await time.increase(1);
    });
    it("MasterChefV3 position will be boosted after locked in VEQst", async function () {
      const newMultiplier = await FarmBoosterSC.getUserMultiplier(1);
      const userPositionInfo = await masterChefV3.userPositionInfos(1);
      expect(userPositionInfo.boostMultiplier).to.deep.eq(newMultiplier);
      const newBoostLiquidity = newMultiplier.mul(userPositionInfo.liquidity).div(BOOST_PRECISION);
      expect(newBoostLiquidity).to.deep.eq(userPositionInfo.boostLiquidity);
    });

    it("The multiplier by getUserMultiplier before staked in MasterChefV3 should be equal to the multiplier after staked in MasterChefV3", async function () {
      // // create lock in VEQst
      let OneYear = BigNumber.from((await time.latest()).toString()).add(YEAR);
      await VEQstSC.connect(user3).createLock(ethers.utils.parseUnits("100"), OneYear);

      await NonfungiblePositionManagerSC.connect(user3).mint({
        token0: pools[0].token0,
        token1: pools[0].token1,
        fee: pools[0].fee,
        tickLower: -100,
        tickUpper: 100,
        amount0Desired: ethers.utils.parseUnits("100"),
        amount1Desired: ethers.utils.parseUnits("100"),
        amount0Min: ethers.constants.Zero,
        amount1Min: ethers.constants.Zero,
        recipient: user3.address,
        deadline: 100000000000000,
      });
      await time.increase(1);
      let multiplierBeforeStake = await FarmBoosterSC.getUserMultiplier(2);

      let positionInfo = await masterChefV3.userPositionInfos(2);
      expect(positionInfo.boostMultiplier).to.deep.eq(ZERO);
      expect(positionInfo.liquidity).to.deep.eq(ZERO);

      //stake in MasterChefV3
      await NonfungiblePositionManagerSC.connect(user3)["safeTransferFrom(address,address,uint256)"](
        user3.address,
        masterChefV3.address,
        2
      );
      await time.increase(1);

      const multiplierAfterStake = await FarmBoosterSC.getUserMultiplier(2);

      // multiplierBeforeStake shoule be greater than BOOST_PRECISION
      expect(multiplierBeforeStake.gt(BOOST_PRECISION)).to.deep.eq(true);
      // multiplierBeforeStake shoule be greater than BOOST_PRECISION
      expect(multiplierAfterStake.gt(BOOST_PRECISION)).to.deep.eq(true);
      expect(multiplierBeforeStake).to.deep.eq(multiplierAfterStake);

      positionInfo = await masterChefV3.userPositionInfos(2);
      expect(multiplierBeforeStake).to.deep.eq(positionInfo.boostMultiplier);
      expect(multiplierAfterStake).to.deep.eq(positionInfo.boostMultiplier);
    });

    it("User multiplier will be equal to BOOST_PRECISION after withdraw from VEQst", async function () {
      const now = BigNumber.from((await time.latest()).toString());
      const AfterOneYear = now.add(YEAR).add(MONTH);

      await time.increaseTo(AfterOneYear.toNumber());

      let qstBalanceBeforeOfUser1 = await QubeSwapTokenSC.balanceOf(user1.address);
      await VEQstSC.connect(user1).withdrawAll(user1.address);
      let qstBalanceAfterOfUser1 = await QubeSwapTokenSC.balanceOf(user1.address);
      expect(qstBalanceAfterOfUser1.sub(qstBalanceBeforeOfUser1)).to.deep.eq(ethers.utils.parseUnits("100"));

      const newMultiplier = await FarmBoosterSC.getUserMultiplier(1);

      expect(newMultiplier).to.deep.eq(BOOST_PRECISION);
    });

    it("User position multiplier will be updated by executed updateLiquidity in MasterChefV3 after withdraw from VEQst", async function () {
      const now = BigNumber.from((await time.latest()).toString());
      const AfterOneYear = now.add(YEAR).add(MONTH);

      await time.increaseTo(AfterOneYear.toNumber());

      let qstBalanceBeforeOfUser1 = await QubeSwapTokenSC.balanceOf(user1.address);
      await VEQstSC.connect(user1).withdrawAll(user1.address);
      let qstBalanceAfterOfUser1 = await QubeSwapTokenSC.balanceOf(user1.address);
      expect(qstBalanceAfterOfUser1.sub(qstBalanceBeforeOfUser1)).to.deep.eq(ethers.utils.parseUnits("100"));

      const newMultiplier = await FarmBoosterSC.getUserMultiplier(1);
      expect(newMultiplier).to.deep.eq(BOOST_PRECISION);
      let userPositionInfoBefore = await masterChefV3.userPositionInfos(1);

      expect(userPositionInfoBefore.liquidity.lt(userPositionInfoBefore.boostLiquidity)).to.deep.eq(true);
      expect(
        userPositionInfoBefore.liquidity.mul(userPositionInfoBefore.boostMultiplier).div(BOOST_PRECISION)
      ).to.deep.eq(userPositionInfoBefore.boostLiquidity);

      // update position boost multiplier in MasterChefV3
      await masterChefV3.updateLiquidity(1);
      let userPositionInfoAfter = await masterChefV3.userPositionInfos(1);
      expect(userPositionInfoAfter.boostMultiplier).to.deep.eq(newMultiplier);
      const newBoostLiquidity = newMultiplier.mul(userPositionInfoAfter.liquidity).div(BOOST_PRECISION);
      expect(newBoostLiquidity).to.deep.eq(userPositionInfoAfter.boostLiquidity);
    });

    it("Get bigger boosted multiplier after created lock in VEQst", async function () {
      await NonfungiblePositionManagerSC.connect(user3).mint({
        token0: pools[0].token0,
        token1: pools[0].token1,
        fee: pools[0].fee,
        tickLower: -100,
        tickUpper: 100,
        amount0Desired: ethers.utils.parseUnits("100"),
        amount1Desired: ethers.utils.parseUnits("100"),
        amount0Min: ethers.constants.Zero,
        amount1Min: ethers.constants.Zero,
        recipient: user3.address,
        deadline: 100000000000000,
      });
      await time.increase(1);
      //stake in MasterChefV3
      await NonfungiblePositionManagerSC.connect(user3)["safeTransferFrom(address,address,uint256)"](
        user3.address,
        masterChefV3.address,
        2
      );
      await time.increase(1);
      const oldMultiplier = await FarmBoosterSC.getUserMultiplier(2);

      // create lock in VEQst
      let OneYear = BigNumber.from((await time.latest()).toString()).add(YEAR);
      await VEQstSC.connect(user3).createLock(ethers.utils.parseUnits("100"), OneYear);
      const newMultiplier = await FarmBoosterSC.getUserMultiplier(2);
      expect(newMultiplier.gt(oldMultiplier)).to.deep.eq(true);
    });

    it("Get bigger boosted multiplier after executed createLockForProxy when migrated from qst pool", async function () {
      const oldMultiplier = await FarmBoosterSC.getUserMultiplier(1);

      // migrate from qst pool
      await VEQstSC.connect(user1).migrateFromQstPool();
      const newMultiplier = await FarmBoosterSC.getUserMultiplier(1);
      expect(newMultiplier.gt(oldMultiplier)).to.deep.eq(true);
    });

    it("Get bigger boosted multiplier after locked more qst", async function () {
      const oldMultiplier = await FarmBoosterSC.getUserMultiplier(1);

      await VEQstSC.connect(user1).increaseLockAmount(ethers.utils.parseUnits("100"));
      const newMultiplier = await FarmBoosterSC.getUserMultiplier(1);
      expect(newMultiplier.gt(oldMultiplier)).to.deep.eq(true);
    });

    it("Get bigger boosted multiplier after extended qst lock end time", async function () {
      const oldMultiplier = await FarmBoosterSC.getUserMultiplier(1);
      let TwoYear = BigNumber.from((await time.latest()).toString()).add(YEAR.mul(2));
      await VEQstSC.connect(user1).increaseUnlockTime(TwoYear);
      const newMultiplier = await FarmBoosterSC.getUserMultiplier(1);

      expect(newMultiplier.gt(oldMultiplier)).to.deep.eq(true);
    });
  });

  describe("Multiple pools and multiple positions", function () {
    beforeEach(async function () {
      await masterChefV3.add(100, poolAddresses[1], true);
      await masterChefV3.add(100, poolAddresses[2], true);

      await FarmBoosterSC.setBoosterFarms([
        [2, true],
        [3, true],
      ]);

      await NonfungiblePositionManagerSC.connect(user1).mint({
        token0: pools[0].token0,
        token1: pools[0].token1,
        fee: pools[0].fee,
        tickLower: -100,
        tickUpper: 100,
        amount0Desired: ethers.utils.parseUnits("100"),
        amount1Desired: ethers.utils.parseUnits("100"),
        amount0Min: ethers.constants.Zero,
        amount1Min: ethers.constants.Zero,
        recipient: user1.address,
        deadline: 100000000000000,
      });
      await time.increase(1);
      // stake in MasterChefV3
      await NonfungiblePositionManagerSC.connect(user1)["safeTransferFrom(address,address,uint256)"](
        user1.address,
        masterChefV3.address,
        1
      );
      await time.increase(1);

      await NonfungiblePositionManagerSC.connect(user1).mint({
        token0: pools[1].token0,
        token1: pools[1].token1,
        fee: pools[1].fee,
        tickLower: -100,
        tickUpper: 100,
        amount0Desired: ethers.utils.parseUnits("100"),
        amount1Desired: ethers.utils.parseUnits("100"),
        amount0Min: ethers.constants.Zero,
        amount1Min: ethers.constants.Zero,
        recipient: user1.address,
        deadline: 100000000000000,
      });
      await time.increase(1);
      // stake in MasterChefV3
      await NonfungiblePositionManagerSC.connect(user1)["safeTransferFrom(address,address,uint256)"](
        user1.address,
        masterChefV3.address,
        2
      );
      await time.increase(1);

      await NonfungiblePositionManagerSC.connect(user1).mint({
        token0: pools[2].token0,
        token1: pools[2].token1,
        fee: pools[2].fee,
        tickLower: -200,
        tickUpper: 200,
        amount0Desired: ethers.utils.parseUnits("10"),
        amount1Desired: ethers.utils.parseUnits("10"),
        amount0Min: ethers.constants.Zero,
        amount1Min: ethers.constants.Zero,
        recipient: user1.address,
        deadline: 100000000000000,
      });
      await time.increase(1);
      //stake in MasterChefV3
      await NonfungiblePositionManagerSC.connect(user1)["safeTransferFrom(address,address,uint256)"](
        user1.address,
        masterChefV3.address,
        3
      );
      await time.increase(1);
    });

    it("Deposit more qst into VEQst pool, all positions multiplier will be greater than before or equal to", async function () {
      const userPositionOneInfo_before = await masterChefV3.userPositionInfos(1);
      const userPositionTwoInfo_before = await masterChefV3.userPositionInfos(2);
      const userPositionThreeInfo_before = await masterChefV3.userPositionInfos(3);

      const userMultiplierOne_before = await FarmBoosterSC.getUserMultiplier(1);
      const userMultiplierTwo_before = await FarmBoosterSC.getUserMultiplier(2);
      const userMultiplierThree_before = await FarmBoosterSC.getUserMultiplier(3);

      expect(userPositionOneInfo_before.boostMultiplier).to.deep.eq(userMultiplierOne_before);
      expect(userPositionTwoInfo_before.boostMultiplier).to.deep.eq(userMultiplierTwo_before);
      expect(userPositionThreeInfo_before.boostMultiplier).to.deep.eq(userMultiplierThree_before);
      // lock more qst into VEQst
      await VEQstSC.connect(user1).increaseLockAmount(ethers.utils.parseUnits("100"));

      // update positions multiplier in MasterChef V3
      await masterChefV3.updateLiquidity(1);
      await masterChefV3.updateLiquidity(2);
      await masterChefV3.updateLiquidity(3);

      const userMultiplierOne_after = await FarmBoosterSC.getUserMultiplier(1);
      const userMultiplierTwo_after = await FarmBoosterSC.getUserMultiplier(2);
      const userMultiplierThree_after = await FarmBoosterSC.getUserMultiplier(3);

      const userPositionOneInfo_after = await masterChefV3.userPositionInfos(1);
      const userPositionTwoInfo_after = await masterChefV3.userPositionInfos(2);
      const userPositionThreeInfo_after = await masterChefV3.userPositionInfos(3);

      expect(userMultiplierOne_after.gte(userMultiplierOne_before)).to.deep.eq(true);
      expect(userMultiplierTwo_after.gte(userMultiplierTwo_before)).to.deep.eq(true);
      expect(userMultiplierThree_after.gte(userMultiplierThree_before)).to.deep.eq(true);

      expect(userPositionOneInfo_after.boostMultiplier.gte(userPositionOneInfo_before.boostMultiplier)).to.deep.eq(
        true
      );
      expect(userPositionTwoInfo_after.boostMultiplier.gte(userPositionTwoInfo_before.boostMultiplier)).to.deep.eq(
        true
      );
      expect(userPositionThreeInfo_after.boostMultiplier.gte(userPositionThreeInfo_before.boostMultiplier)).to.deep.eq(
        true
      );
    });

    it("Extend qst lock end time, all positions multiplier will be greater than before or equal to", async function () {
      const userPositionOneInfo_before = await masterChefV3.userPositionInfos(1);
      const userPositionTwoInfo_before = await masterChefV3.userPositionInfos(2);
      const userPositionThreeInfo_before = await masterChefV3.userPositionInfos(3);

      const userMultiplierOne_before = await FarmBoosterSC.getUserMultiplier(1);
      const userMultiplierTwo_before = await FarmBoosterSC.getUserMultiplier(2);
      const userMultiplierThree_before = await FarmBoosterSC.getUserMultiplier(3);

      expect(userPositionOneInfo_before.boostMultiplier).to.deep.eq(userMultiplierOne_before);
      expect(userPositionTwoInfo_before.boostMultiplier).to.deep.eq(userMultiplierTwo_before);
      expect(userPositionThreeInfo_before.boostMultiplier).to.deep.eq(userMultiplierThree_before);
      // extend lock end time
      let TwoYear = BigNumber.from((await time.latest()).toString()).add(YEAR.mul(2));
      await VEQstSC.connect(user1).increaseUnlockTime(TwoYear);

      // update positions multiplier in MasterChef V3
      await masterChefV3.updateLiquidity(1);
      await masterChefV3.updateLiquidity(2);
      await masterChefV3.updateLiquidity(3);

      const userMultiplierOne_after = await FarmBoosterSC.getUserMultiplier(1);
      const userMultiplierTwo_after = await FarmBoosterSC.getUserMultiplier(2);
      const userMultiplierThree_after = await FarmBoosterSC.getUserMultiplier(3);

      const userPositionOneInfo_after = await masterChefV3.userPositionInfos(1);
      const userPositionTwoInfo_after = await masterChefV3.userPositionInfos(2);
      const userPositionThreeInfo_after = await masterChefV3.userPositionInfos(3);

      expect(userMultiplierOne_after.gte(userMultiplierOne_before)).to.deep.eq(true);
      expect(userMultiplierTwo_after.gte(userMultiplierTwo_before)).to.deep.eq(true);
      expect(userMultiplierThree_after.gte(userMultiplierThree_before)).to.deep.eq(true);

      expect(userPositionOneInfo_after.boostMultiplier.gte(userPositionOneInfo_before.boostMultiplier)).to.deep.eq(
        true
      );
      expect(userPositionTwoInfo_after.boostMultiplier.gte(userPositionTwoInfo_before.boostMultiplier)).to.deep.eq(
        true
      );
      expect(userPositionThreeInfo_after.boostMultiplier.gte(userPositionThreeInfo_before.boostMultiplier)).to.deep.eq(
        true
      );
    });

    it("WithdrawAll qst in VEQst pool, all positions multiplier will be BOOST_PRECISION", async function () {
      const userPositionOneInfo_before = await masterChefV3.userPositionInfos(1);
      const userPositionTwoInfo_before = await masterChefV3.userPositionInfos(2);
      const userPositionThreeInfo_before = await masterChefV3.userPositionInfos(3);

      const userMultiplierOne_before = await FarmBoosterSC.getUserMultiplier(1);
      const userMultiplierTwo_before = await FarmBoosterSC.getUserMultiplier(2);
      const userMultiplierThree_before = await FarmBoosterSC.getUserMultiplier(3);

      expect(userPositionOneInfo_before.boostMultiplier).to.deep.eq(userMultiplierOne_before);
      expect(userPositionTwoInfo_before.boostMultiplier).to.deep.eq(userMultiplierTwo_before);
      expect(userPositionThreeInfo_before.boostMultiplier).to.deep.eq(userMultiplierThree_before);
      // withdraw all
      let TwoYear = BigNumber.from((await time.latest()).toString()).add(YEAR.mul(2));
      await time.increaseTo(TwoYear.toNumber());
      await VEQstSC.connect(user1).withdrawAll(user1.address);

      // update positions multiplier in MasterChef V3
      await masterChefV3.updateLiquidity(1);
      await masterChefV3.updateLiquidity(2);
      await masterChefV3.updateLiquidity(3);

      const userMultiplierOne_after = await FarmBoosterSC.getUserMultiplier(1);
      const userMultiplierTwo_after = await FarmBoosterSC.getUserMultiplier(2);
      const userMultiplierThree_after = await FarmBoosterSC.getUserMultiplier(3);

      const userPositionOneInfo_after = await masterChefV3.userPositionInfos(1);
      const userPositionTwoInfo_after = await masterChefV3.userPositionInfos(2);
      const userPositionThreeInfo_after = await masterChefV3.userPositionInfos(3);

      expect(userMultiplierOne_after.lte(userMultiplierOne_before)).to.deep.eq(true);
      expect(userMultiplierTwo_after.lte(userMultiplierTwo_before)).to.deep.eq(true);
      expect(userMultiplierThree_after.lte(userMultiplierThree_before)).to.deep.eq(true);

      expect(userPositionOneInfo_after.boostMultiplier.lte(userPositionOneInfo_before.boostMultiplier)).to.deep.eq(
        true
      );
      expect(userPositionTwoInfo_after.boostMultiplier.lte(userPositionTwoInfo_before.boostMultiplier)).to.deep.eq(
        true
      );
      expect(userPositionThreeInfo_after.boostMultiplier.lte(userPositionThreeInfo_before.boostMultiplier)).to.deep.eq(
        true
      );

      expect(userPositionOneInfo_after.boostMultiplier).to.deep.eq(BOOST_PRECISION);
      expect(userPositionTwoInfo_after.boostMultiplier).to.deep.eq(BOOST_PRECISION);
      expect(userPositionThreeInfo_after.boostMultiplier).to.deep.eq(BOOST_PRECISION);
    });
  });

  describe("Special cases", function () {
    beforeEach(async function () {
      await masterChefV3.add(100, poolAddresses[1], true);

      await NonfungiblePositionManagerSC.connect(user1).mint({
        token0: pools[1].token0,
        token1: pools[1].token1,
        fee: pools[1].fee,
        tickLower: -100,
        tickUpper: 100,
        amount0Desired: ethers.utils.parseUnits("100"),
        amount1Desired: ethers.utils.parseUnits("100"),
        amount0Min: ethers.constants.Zero,
        amount1Min: ethers.constants.Zero,
        recipient: user1.address,
        deadline: 100000000000000,
      });
    });
    it("Stake in MasterChef V3 , Remove all liquidity , can not increase liquidity", async function () {
      // // stake in MasterChefV3
      await NonfungiblePositionManagerSC.connect(user1)["safeTransferFrom(address,address,uint256)"](
        user1.address,
        masterChefV3.address,
        1
      );
      await time.increase(1);

      let positionInfo1 = await masterChefV3.userPositionInfos(1);
      expect(positionInfo1.liquidity.gt(ZERO)).to.deep.eq(true);
      // decrease all liquidity
      await masterChefV3.connect(user1).decreaseLiquidity({
        tokenId: 1,
        liquidity: positionInfo1.liquidity,
        amount0Min: ethers.constants.Zero,
        amount1Min: ethers.constants.Zero,
        deadline: (await time.latest()) + 1,
      });
      positionInfo1 = await masterChefV3.userPositionInfos(1);

      expect(positionInfo1.liquidity).to.deep.eq(ZERO);
      expect(positionInfo1.boostLiquidity).to.deep.eq(ZERO);
      expect(positionInfo1.boostMultiplier.gt(ZERO)).to.deep.eq(true);

      await expectRevert.unspecified(
        masterChefV3.connect(user1).increaseLiquidity({
          tokenId: 1,
          amount0Desired: ethers.utils.parseUnits("2"),
          amount1Desired: ethers.utils.parseUnits("2"),
          amount0Min: ethers.constants.Zero,
          amount1Min: ethers.constants.Zero,
          deadline: (await time.latest()) + 1,
        })
      );
      await masterChefV3.connect(user1).withdraw(1, user1.address);
      positionInfo1 = await masterChefV3.userPositionInfos(1);

      expect(positionInfo1.liquidity).to.deep.eq(ZERO);
      expect(positionInfo1.boostLiquidity).to.deep.eq(ZERO);
      expect(positionInfo1.tickLower).to.deep.eq(0);
      expect(positionInfo1.tickUpper).to.deep.eq(0);
    });

    it("Stake in MasterChef V3 before set famrm booster, then set farm booster, can withdraw successfully", async function () {
      // // stake in MasterChefV3
      await NonfungiblePositionManagerSC.connect(user1)["safeTransferFrom(address,address,uint256)"](
        user1.address,
        masterChefV3.address,
        1
      );
      await time.increase(1);
      let whiteListStatus = await FarmBoosterSC.whiteList(2);
      expect(whiteListStatus).to.deep.eq(false);
      await FarmBoosterSC.setBoosterFarms([[2, true]]);
      whiteListStatus = await FarmBoosterSC.whiteList(2);
      expect(whiteListStatus).to.deep.eq(true);

      let positionInfo1 = await masterChefV3.userPositionInfos(1);
      expect(positionInfo1.liquidity.gt(ZERO)).to.deep.eq(true);

      await masterChefV3.connect(user1).withdraw(1, user1.address);
      positionInfo1 = await masterChefV3.userPositionInfos(1);

      expect(positionInfo1.liquidity).to.deep.eq(ZERO);
      expect(positionInfo1.boostLiquidity).to.deep.eq(ZERO);
      expect(positionInfo1.tickLower).to.deep.eq(0);
      expect(positionInfo1.tickUpper).to.deep.eq(0);
    });

    it("Stake in MasterChef V3 before set famrm booster, then set farm booster, multiplier from getUserMultiplier before updated will be same as boostMultiplier after updated position liquidity", async function () {
      // // stake in MasterChefV3
      await NonfungiblePositionManagerSC.connect(user1)["safeTransferFrom(address,address,uint256)"](
        user1.address,
        masterChefV3.address,
        1
      );
      await time.increase(1);
      let whiteListStatus = await FarmBoosterSC.whiteList(2);
      expect(whiteListStatus).to.deep.eq(false);

      let multiplierBeforeSetWhitelist = await FarmBoosterSC.getUserMultiplier(1);
      expect(multiplierBeforeSetWhitelist).to.deep.eq(BOOST_PRECISION);

      await FarmBoosterSC.setBoosterFarms([[2, true]]);
      whiteListStatus = await FarmBoosterSC.whiteList(2);
      expect(whiteListStatus).to.deep.eq(true);

      let positionInfo1 = await masterChefV3.userPositionInfos(1);
      expect(positionInfo1.liquidity.gt(ZERO)).to.deep.eq(true);

      let expectMultiplier = await FarmBoosterSC.getUserMultiplier(1);

      await masterChefV3.connect(user1).updateLiquidity(1);
      positionInfo1 = await masterChefV3.userPositionInfos(1);

      expect(positionInfo1.boostMultiplier).to.deep.eq(expectMultiplier);
    });
  });

  describe("Owner operations", function () {
    it("Set Booster Farms", async function () {
      let pool1WhiteList = await FarmBoosterSC.whiteList(1);
      expect(pool1WhiteList).eq(true);

      await masterChefV3.add(100, poolAddresses[1], true);
      await masterChefV3.add(100, poolAddresses[2], true);

      let pool2WhiteList = await FarmBoosterSC.whiteList(2);
      let pool3WhiteList = await FarmBoosterSC.whiteList(3);
      expect(pool2WhiteList).eq(false);
      expect(pool3WhiteList).eq(false);

      await FarmBoosterSC.setBoosterFarms([
        [2, true],
        [3, true],
      ]);

      pool2WhiteList = await FarmBoosterSC.whiteList(2);
      pool3WhiteList = await FarmBoosterSC.whiteList(3);
      expect(pool2WhiteList).eq(true);
      expect(pool3WhiteList).eq(true);
    });

    it("Set CA", async function () {
      const MIN_CA = BigNumber.from(10).pow(4);
      const MAX_CA = BigNumber.from(10).pow(5);

      await expectRevert(FarmBoosterSC.setCA(MIN_CA.sub(1)), "Invalid cA");
      await expectRevert(FarmBoosterSC.setCA(MAX_CA.add(1)), "Invalid cA");

      const NEW_CA = MIN_CA.add(6666);
      await FarmBoosterSC.setCA(NEW_CA);
      let cA = await FarmBoosterSC.cA();
      expect(cA).to.deep.eq(NEW_CA);
    });

    it("Set CB", async function () {
      const MIN_CB = BigNumber.from(0);
      const MAX_CB = BigNumber.from(10).pow(8);
      await expectRevert(FarmBoosterSC.setCB(MIN_CB), "Invalid cB");
      await expectRevert(FarmBoosterSC.setCB(MAX_CB.add(1)), "Invalid cB");
      const NEW_CB = MIN_CB.add(6666);
      await FarmBoosterSC.setCB(NEW_CB);
      let cB = await FarmBoosterSC.cB();
      expect(cB).to.deep.eq(NEW_CB);
    });

    it("Set CB Override", async function () {
      const MAX_CB = BigNumber.from(10).pow(8);
      await expectRevert(FarmBoosterSC.setCBOverride(1, MAX_CB.add(1)), "Invalid cB");

      const NEW_CB = BigNumber.from(88888888);
      await FarmBoosterSC.setCBOverride(1, NEW_CB);
      let cB = await FarmBoosterSC.cBOverride(1);
      expect(cB).to.deep.eq(NEW_CB);
    });
  });
});
