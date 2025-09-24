import { artifacts, contract, ethers, network } from "hardhat";
import { time, BN, expectEvent, expectRevert } from "@openzeppelin/test-helpers";
import { parseEther, formatEther } from "ethers/lib/utils";
import { expect } from "chai";
import { beforeEach } from "mocha";
import { BigNumber } from "ethers";

import ERC20MockArtifact from "./artifactsFile/ERC20Mock.json";
import QubeSwapTokenArtifact from "./artifactsFile/QubeSwapToken.json";
import SyrupBarArtifact from "./artifactsFile/SyrupBar.json";
import MasterChefArtifact from "./artifactsFile/MasterChef.json";
import MasterChefV2Artifact from "./artifactsFile/MasterChefV2.json";
import QstPoolArtifact from "./artifactsFile/QstPool.json";
import VEQstArtifact from "./artifactsFile/VEQstTest.json";
import ProxyForQstPoolArtifact from "./artifactsFile/ProxyForQstPool.json";
import ProxyForQstPoolFactoryArtifact from "./artifactsFile/ProxyForQstPoolFactory.json";
import DelegatorArtifact from "./artifactsFile/Delegator.json";

const ZERO = BigNumber.from(0);
const DAY = BigNumber.from(86400);
const WEEK = DAY.mul(7);
const YEAR = DAY.mul(365);
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

describe("VQst", () => {
  let ProxyForQstPoolFactorySC, masterChefV2, QstPoolSC, VEQstSC, QubeSwapTokenSC;
  let admin;
  let user1;
  let user2;
  let user3;
  let user4;
  let treasury;
  let redistributor;
  before(async function () {
    [admin, user1, user2, user3, user4, treasury, redistributor] = await ethers.getSigners();
  });

  beforeEach(async () => {
    const ERC20Mock = await ethers.getContractFactoryFromArtifact(ERC20MockArtifact);

    // deploy qst token
    const QubeSwapToken = await ethers.getContractFactoryFromArtifact(QubeSwapTokenArtifact);
    QubeSwapTokenSC = await QubeSwapToken.deploy();
    // mint qst for users
    await QubeSwapTokenSC["mint(address,uint256)"](admin.address, ethers.utils.parseUnits("100000000000000"));
    await QubeSwapTokenSC["mint(address,uint256)"](user1.address, ethers.utils.parseUnits("100000000"));
    await QubeSwapTokenSC["mint(address,uint256)"](user2.address, ethers.utils.parseUnits("100000000"));
    await QubeSwapTokenSC["mint(address,uint256)"](user3.address, ethers.utils.parseUnits("100000000"));
    await QubeSwapTokenSC["mint(address,uint256)"](user4.address, ethers.utils.parseUnits("100000000"));

    // deploy SyrupBar
    const SyrupBar = await ethers.getContractFactoryFromArtifact(SyrupBarArtifact);
    const syrupBar = await SyrupBar.deploy(QubeSwapTokenSC.address);

    // deploy MasterChef
    const MasterChef = await ethers.getContractFactoryFromArtifact(MasterChefArtifact);
    const masterChef = await MasterChef.deploy(
      QubeSwapTokenSC.address,
      syrupBar.address,
      admin.address,
      ethers.utils.parseUnits("40"),
      ethers.constants.Zero
    );

    // transfer ownership to MasterChef
    await QubeSwapTokenSC.transferOwnership(masterChef.address);
    await syrupBar.transferOwnership(masterChef.address);

    const lpTokenV1 = await ERC20Mock.deploy("LP Token V1", "LPV1");
    const dummyTokenV2 = await ERC20Mock.deploy("Dummy Token V2", "DTV2");

    // add pools in MasterChef
    await masterChef.add(0, lpTokenV1.address, true); // farm with pid 1 and 0 allocPoint
    await masterChef.add(1, dummyTokenV2.address, true); // farm with pid 2 and 1 allocPoint

    // deploy MasterChefV2
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

    // deploy qst pool
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

    //  approve qst for QstPoolSC
    await QubeSwapTokenSC.connect(admin).approve(QstPoolSC.address, ethers.constants.MaxUint256);
    await QubeSwapTokenSC.connect(user1).approve(QstPoolSC.address, ethers.constants.MaxUint256);
    await QubeSwapTokenSC.connect(user2).approve(QstPoolSC.address, ethers.constants.MaxUint256);
    await QubeSwapTokenSC.connect(user3).approve(QstPoolSC.address, ethers.constants.MaxUint256);
    await QubeSwapTokenSC.connect(user4).approve(QstPoolSC.address, ethers.constants.MaxUint256);

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

    // lock qst in qst pool
    await QstPoolSC.connect(user1).deposit(ethers.utils.parseUnits("1000"), 3600 * 24 * 365);
    await QstPoolSC.connect(user2).deposit(ethers.utils.parseUnits("1000"), 3600 * 24 * 365);
    await QstPoolSC.connect(user3).deposit(ethers.utils.parseUnits("1000"), 3600 * 24 * 365);
  });

  afterEach(async () => {
    await network.provider.send("hardhat_reset");
  });

  describe("users migrate from qst pool", () => {
    beforeEach(async function () {
      // stop emission in qst pool
      await masterChefV2.set(2, 0, true);
      await masterChefV2.set(3, 1, true);
      // update qst pool
      await QstPoolSC.connect(user1).deposit(ethers.utils.parseUnits("1"), 0);
    });

    it("Migrated successfully", async function () {
      let userInfoOfUser2InQstPool = await QstPoolSC.userInfo(user2.address);

      let totalShares = await QstPoolSC.totalShares();
      let balanceOf = await QstPoolSC.balanceOf();
      // uint256 currentAmount = (balanceOf() * (user.shares)) / totalShares - user.userBoostedShare;
      let currentLockedBalanceOfUser2 = userInfoOfUser2InQstPool.shares
        .mul(balanceOf)
        .div(totalShares)
        .sub(userInfoOfUser2InQstPool.userBoostedShare)
        .sub(1);

      // migrate from qst pool
      await VEQstSC.connect(user2).migrateFromQstPool();

      let userInfoOfUser2InVEQst = await VEQstSC.getUserInfo(user2.address);

      let ProxyForQstPool = await ethers.getContractFactoryFromArtifact(ProxyForQstPoolArtifact);
      let ProxyForQstPoolSC = await ProxyForQstPool.attach(userInfoOfUser2InVEQst.qstPoolProxy);

      let qstPoolUser = await ProxyForQstPoolSC.qstPoolUser();

      expect(qstPoolUser).to.deep.eq(user2.address);
      expect(userInfoOfUser2InVEQst.amount).to.deep.eq(ZERO);
      expect(userInfoOfUser2InVEQst.end).to.deep.eq(ZERO);
      expect(userInfoOfUser2InVEQst.qstPoolType).to.deep.eq(1);
      expect(userInfoOfUser2InVEQst.withdrawFlag).to.deep.eq(0);
      expect(userInfoOfUser2InQstPool.lockEndTime.toString()).to.deep.eq(
        userInfoOfUser2InVEQst.lockEndTime.toString()
      );
      expect(currentLockedBalanceOfUser2).to.deep.eq(userInfoOfUser2InVEQst.qstAmount);

      let proxyLockedBalanceOfUser2 = await VEQstSC.locks(userInfoOfUser2InVEQst.qstPoolProxy);

      expect(proxyLockedBalanceOfUser2.amount).to.deep.eq(userInfoOfUser2InVEQst.qstAmount);
      expect(proxyLockedBalanceOfUser2.end).to.deep.eq(
        BigNumber.from(userInfoOfUser2InVEQst.lockEndTime).div(WEEK).mul(WEEK)
      );

      // can not deposit again in qst pool

      //   await QstPoolSC.connect(user2).deposit(ethers.utils.parseUnits("10"),0);

      await expectRevert.unspecified(QstPoolSC.connect(user2).deposit(ethers.utils.parseUnits("10"), 0));

      await time.increaseTo(userInfoOfUser2InQstPool.lockEndTime.add(1).toNumber());

      await QstPoolSC.connect(user2).withdraw(userInfoOfUser2InQstPool.shares);

      userInfoOfUser2InQstPool = await QstPoolSC.userInfo(user2.address);
      // console.log(userInfoOfUser2InQstPool);

      let allUserInfo = await VEQstSC.getUserInfo(user2.address);
      // console.log(allUserInfo);
    });

    it("Can not deposit in qst pool after Migrated", async function () {
      // migrate from qst pool
      await VEQstSC.connect(user2).migrateFromQstPool();

      // can not deposit again in qst pool
      await expectRevert.unspecified(QstPoolSC.connect(user2).deposit(ethers.utils.parseUnits("10"), 0));
    });

    it("Can withdraw in qst pool after Migration lock expired", async function () {
      // migrate from qst pool
      await VEQstSC.connect(user2).migrateFromQstPool();

      let userInfoOfUser2InQstPool = await QstPoolSC.userInfo(user2.address);

      await time.increaseTo(userInfoOfUser2InQstPool.lockEndTime.add(1).toNumber());

      await QstPoolSC.connect(user2).withdraw(userInfoOfUser2InQstPool.shares);

      let userInfoOfUser2InVEQst = await VEQstSC.getUserInfo(user2.address);
      expect(userInfoOfUser2InVEQst.withdrawFlag).to.deep.eq(1);

      let proxyLockedBalanceOfUser2 = await VEQstSC.locks(userInfoOfUser2InVEQst.qstPoolProxy);

      expect(proxyLockedBalanceOfUser2.amount).to.deep.eq(ZERO);
      expect(proxyLockedBalanceOfUser2.end).to.deep.eq(ZERO);
    });

    it("Check whether the qst amount is calculated correctly", async function () {
      // migrate from qst pool
      await VEQstSC.connect(user2).migrateFromQstPool();

      let userInfoOfUser2InQstPool = await QstPoolSC.userInfo(user2.address);

      await time.increaseTo(userInfoOfUser2InQstPool.lockEndTime.add(1).toNumber());

      let qstBalanceBeforeOfUser2 = await QubeSwapTokenSC.balanceOf(user2.address);

      await QstPoolSC.connect(user2).withdraw(userInfoOfUser2InQstPool.shares);

      let qstBalanceAfterOfUser2 = await QubeSwapTokenSC.balanceOf(user2.address);

      let userInfoOfUser2InVEQst = await VEQstSC.getUserInfo(user2.address);

      expect(userInfoOfUser2InVEQst.withdrawFlag).to.deep.eq(1);

      let proxyLockedBalanceOfUser2 = await VEQstSC.locks(userInfoOfUser2InVEQst.qstPoolProxy);

      expect(proxyLockedBalanceOfUser2.amount).to.deep.eq(ZERO);
      expect(proxyLockedBalanceOfUser2.end).to.deep.eq(ZERO);
      expect(qstBalanceAfterOfUser2.sub(qstBalanceBeforeOfUser2)).to.deep.eq(userInfoOfUser2InVEQst.qstAmount);
    });
  });

  describe("users delegate from qst pool", () => {
    let delegatorSC;

    beforeEach(async function () {
      // stop emission in qst pool
      await masterChefV2.set(2, 0, true);
      await masterChefV2.set(3, 1, true);
      // update qst pool
      await QstPoolSC.connect(user1).deposit(ethers.utils.parseUnits("1"), 0);

      // deploy mock delegator smart contract
      const Delegator = await ethers.getContractFactoryFromArtifact(DelegatorArtifact);
      delegatorSC = await Delegator.deploy(VEQstSC.address, QubeSwapTokenSC.address);

      let now = (await time.latest()).toString();
      let OneYear = BigNumber.from(now).add(YEAR);

      // add whitelist for delegator in VEQstSC
      await VEQstSC.setWhitelistedCallers([delegatorSC.address], true);
      // add delegator in VEQstSC
      await VEQstSC.updateDelegator(delegatorSC.address, true, OneYear);

      // create lock for delegator
      await QubeSwapTokenSC.approve(delegatorSC.address, ethers.utils.parseUnits("1"));
      await delegatorSC.createLock(ethers.utils.parseUnits("1"), OneYear);
    });

    it("Delegated successfully", async function () {
      let userInfoOfUser3InQstPool = await QstPoolSC.userInfo(user3.address);

      let totalShares = await QstPoolSC.totalShares();
      let balanceOf = await QstPoolSC.balanceOf();
      // uint256 currentAmount = (balanceOf() * (user.shares)) / totalShares - user.userBoostedShare;
      let currentLockedBalanceOfUser3 = userInfoOfUser3InQstPool.shares
        .mul(balanceOf)
        .div(totalShares)
        .sub(userInfoOfUser3InQstPool.userBoostedShare)
        .sub(1);

      // delegate from qst pool
      await VEQstSC.connect(user3).delegateFromQstPool(delegatorSC.address);

      let delegatorTokenBalanceOfUser3 = await delegatorSC.balanceOf(user3.address);

      let userInfoOfUser3InVEQst = await VEQstSC.userInfo(user3.address);
      let delegatorInfo = await VEQstSC.delegator(delegatorSC.address);

      expect(delegatorTokenBalanceOfUser3).to.deep.eq(userInfoOfUser3InVEQst.qstAmount);

      expect(userInfoOfUser3InVEQst.qstPoolProxy).to.deep.eq(ZERO_ADDRESS);
      expect(userInfoOfUser3InVEQst.qstAmount).to.deep.eq(currentLockedBalanceOfUser3);
      expect(BigNumber.from(userInfoOfUser3InVEQst.lockEndTime)).to.deep.eq(
        BigNumber.from(userInfoOfUser3InQstPool.lockEndTime)
      );
      expect(userInfoOfUser3InVEQst.qstPoolType).to.deep.eq(2);

      expect(delegatorInfo.delegatedQstAmount).to.deep.eq(currentLockedBalanceOfUser3);
      expect(delegatorInfo.delegatedQstAmount).to.deep.eq(userInfoOfUser3InVEQst.qstAmount);
      expect(delegatorInfo.delegatedQstAmount).to.deep.eq(delegatorInfo.notInjectedQstAmount);
    });

    it("Can not deposit in qst pool after delegated", async function () {
      // delegate from qst pool
      await VEQstSC.connect(user3).delegateFromQstPool(delegatorSC.address);

      // can not deposit again in qst pool
      await expectRevert.unspecified(QstPoolSC.connect(user3).deposit(ethers.utils.parseUnits("10"), 0));
    });

    it("Can not withdraw in qst pool after delegation lock expired", async function () {
      // delegate from qst pool
      await VEQstSC.connect(user3).delegateFromQstPool(delegatorSC.address);

      // can not deposit again in qst pool
      await expectRevert.unspecified(QstPoolSC.connect(user3).deposit(ethers.utils.parseUnits("10"), 0));

      let userInfoOfUser3InQstPool = await QstPoolSC.userInfo(user3.address);

      await time.increaseTo(userInfoOfUser3InQstPool.lockEndTime.add(1).toNumber());

      await expectRevert.unspecified(QstPoolSC.connect(user3).withdraw(userInfoOfUser3InQstPool.shares));
    });

    it("Can inject qst for delegator", async function () {
      // delegate from qst pool
      await VEQstSC.connect(user3).delegateFromQstPool(delegatorSC.address);

      let delegatorInfo = await VEQstSC.delegator(delegatorSC.address);
      await VEQstSC.injectToDelegator(delegatorSC.address, delegatorInfo.notInjectedQstAmount);

      delegatorInfo = await VEQstSC.delegator(delegatorSC.address);
      expect(delegatorInfo.notInjectedQstAmount).to.deep.eq(ZERO);
    });
  });

  describe("Migration can be converted to delegation", () => {
    let delegatorSC;
    beforeEach(async function () {
      // stop emission in qst pool
      await masterChefV2.set(2, 0, true);
      await masterChefV2.set(3, 1, true);
      // update qst pool
      await QstPoolSC.connect(user1).deposit(ethers.utils.parseUnits("1"), 0);

      // deploy mock delegator smart contract
      const Delegator = await ethers.getContractFactoryFromArtifact(DelegatorArtifact);
      delegatorSC = await Delegator.deploy(VEQstSC.address, QubeSwapTokenSC.address);

      let now = (await time.latest()).toString();
      let OneYear = BigNumber.from(now).add(YEAR);

      // add whitelist for delegator in VEQstSC
      await VEQstSC.setWhitelistedCallers([delegatorSC.address], true);
      // add delegator in VEQstSC
      await VEQstSC.updateDelegator(delegatorSC.address, true, OneYear);

      // create lock for delegator
      await QubeSwapTokenSC.approve(delegatorSC.address, ethers.utils.parseUnits("1"));
      await delegatorSC.createLock(ethers.utils.parseUnits("1"), OneYear);
    });

    it("Delegated from migration successfully", async function () {
      let userInfoOfUser2InQstPool = await QstPoolSC.userInfo(user2.address);

      let totalShares = await QstPoolSC.totalShares();
      let balanceOf = await QstPoolSC.balanceOf();
      // uint256 currentAmount = (balanceOf() * (user.shares)) / totalShares - user.userBoostedShare;
      let currentLockedBalanceOfUser2 = userInfoOfUser2InQstPool.shares
        .mul(balanceOf)
        .div(totalShares)
        .sub(userInfoOfUser2InQstPool.userBoostedShare)
        .sub(1);

      await VEQstSC.connect(user2).migrateFromQstPool();

      let userInfoOfUser2InVEQst = await VEQstSC.userInfo(user2.address);

      // console.log(userInfoOfUser2InVEQst);

      expect(userInfoOfUser2InQstPool.lockEndTime.toString()).to.deep.eq(
        userInfoOfUser2InVEQst.lockEndTime.toString()
      );
      expect(currentLockedBalanceOfUser2).to.deep.eq(userInfoOfUser2InVEQst.qstAmount);

      await VEQstSC.connect(user2).migrationConvertToDelegation(delegatorSC.address);

      let delegatorInfo = await VEQstSC.delegator(delegatorSC.address);

      expect(delegatorInfo.delegatedQstAmount).to.deep.eq(currentLockedBalanceOfUser2);
      expect(delegatorInfo.delegatedQstAmount).to.deep.eq(userInfoOfUser2InVEQst.qstAmount);
      expect(delegatorInfo.delegatedQstAmount).to.deep.eq(delegatorInfo.notInjectedQstAmount);
    });

    it("Can not withdraw in qst pool after delegation lock expired", async function () {
      await VEQstSC.connect(user2).migrateFromQstPool();
      await VEQstSC.connect(user2).migrationConvertToDelegation(delegatorSC.address);

      let userInfoOfUser2InQstPool = await QstPoolSC.userInfo(user2.address);

      await time.increaseTo(userInfoOfUser2InQstPool.lockEndTime.add(1).toNumber());

      await expectRevert.unspecified(QstPoolSC.connect(user3).withdraw(userInfoOfUser2InQstPool.shares));
    });

    it("Can not delegate after migration limit time", async function () {
      await VEQstSC.connect(user2).migrateFromQstPool();

      let now = (await time.latest()).toString();
      let limitTimeOfConvert = await VEQstSC.limitTimeOfConvert();
      let targetTimestamp = BigNumber.from(now).add(limitTimeOfConvert);
      await time.increaseTo(targetTimestamp.toNumber());

      await expectRevert(VEQstSC.connect(user2).migrationConvertToDelegation(delegatorSC.address), "Too late");
    });

    it("Can not delegate after lock expired in qst pool", async function () {
      await VEQstSC.connect(user2).migrateFromQstPool();

      let now = (await time.latest()).toString();
      let userInfoOfUser2InVEQst = await VEQstSC.userInfo(user2.address);
      let lockEndTime = BigNumber.from(userInfoOfUser2InVEQst.lockEndTime);
      await time.increaseTo(lockEndTime.add(1).toNumber());

      await expectRevert(
        VEQstSC.connect(user2).migrationConvertToDelegation(delegatorSC.address),
        "User lock expired"
      );
    });
  });

  describe("Delegator withdraw", () => {
    let delegatorSC;
    beforeEach(async function () {
      // stop emission in qst pool
      await masterChefV2.set(2, 0, true);
      await masterChefV2.set(3, 1, true);
      // update qst pool
      await QstPoolSC.connect(user1).deposit(ethers.utils.parseUnits("1"), 0);

      // deploy mock delegator smart contract
      const Delegator = await ethers.getContractFactoryFromArtifact(DelegatorArtifact);
      delegatorSC = await Delegator.deploy(VEQstSC.address, QubeSwapTokenSC.address);

      let now = (await time.latest()).toString();
      let OneYear = BigNumber.from(now).add(YEAR);
      let halfYear = BigNumber.from(now).add(YEAR.div(2));

      // add whitelist for delegator in VEQstSC
      await VEQstSC.setWhitelistedCallers([delegatorSC.address], true);
      // add delegator in VEQstSC
      await VEQstSC.updateDelegator(delegatorSC.address, true, halfYear);

      // create lock for delegator
      await QubeSwapTokenSC.approve(delegatorSC.address, ethers.utils.parseUnits("1"));
      await delegatorSC.createLock(ethers.utils.parseUnits("1"), OneYear);

      // delegate from qst pool
      await VEQstSC.connect(user3).delegateFromQstPool(delegatorSC.address);
    });

    it("Delegator can not withdraw before injected all", async function () {
      let delegatorLockedBalance = await VEQstSC.locks(delegatorSC.address);

      await time.increaseTo(delegatorLockedBalance.end.add(1).toNumber());
      await expectRevert(delegatorSC.withdrawAll(delegatorSC.address), "Insufficient injection for delegator");
    });

    it("Delegator can withdraw after injected all", async function () {
      let delegatorLockedBalance = await VEQstSC.locks(delegatorSC.address);

      await time.increaseTo(delegatorLockedBalance.end.add(1).toNumber());

      let delegatorInfo = await VEQstSC.delegator(delegatorSC.address);
      await VEQstSC.injectToDelegator(delegatorSC.address, delegatorInfo.notInjectedQstAmount);

      let qstBalanceBeforeOfDelegator = await QubeSwapTokenSC.balanceOf(delegatorSC.address);
      await delegatorSC.withdrawAll(delegatorSC.address);

      let qstBalanceAfterOfDelegator = await QubeSwapTokenSC.balanceOf(delegatorSC.address);

      expect(qstBalanceAfterOfDelegator.sub(qstBalanceBeforeOfDelegator)).to.deep.eq(
        delegatorInfo.delegatedQstAmount.add(ethers.utils.parseUnits("1"))
      );
    });

    it("Delegator can not early withdraw before limit Timestamp For Early Withdraw", async function () {
      await VEQstSC.setEarlyWithdrawSwitch(true);
      await expectRevert(
        delegatorSC.earlyWithdraw(delegatorSC.address, ethers.utils.parseUnits("1")),
        "Forbid earlyWithdraw"
      );
    });

    it("Delegator can not early withdraw when amount exceed injected amount", async function () {
      await VEQstSC.setEarlyWithdrawSwitch(true);
      let delegatorInfo = await VEQstSC.delegator(delegatorSC.address);
      await time.increaseTo(BigNumber.from(delegatorInfo.limitTimestampForEarlyWithdraw).add(1).toNumber());
      await expectRevert(
        delegatorSC.earlyWithdraw(delegatorSC.address, ethers.utils.parseUnits("2")),
        "Delegator balance exceeded"
      );
    });

    it("Delegator can early withdraw after limit Timestamp For Early Withdraw", async function () {
      await VEQstSC.setEarlyWithdrawSwitch(true);
      let delegatorInfo = await VEQstSC.delegator(delegatorSC.address);
      await time.increaseTo(BigNumber.from(delegatorInfo.limitTimestampForEarlyWithdraw).add(1).toNumber());

      let qstBalanceBeforeOfDelegator = await QubeSwapTokenSC.balanceOf(delegatorSC.address);
      await delegatorSC.earlyWithdraw(delegatorSC.address, ethers.utils.parseUnits("1"));

      let qstBalanceAfterOfDelegator = await QubeSwapTokenSC.balanceOf(delegatorSC.address);

      expect(qstBalanceAfterOfDelegator.sub(qstBalanceBeforeOfDelegator)).to.deep.eq(ethers.utils.parseUnits("1"));
    });
  });

  describe("Normal user lock qst in VEQst", () => {
    beforeEach(async function () {
      // stop emission in qst pool
      await masterChefV2.set(2, 0, true);
      await masterChefV2.set(3, 1, true);
      // update qst pool
      await QstPoolSC.connect(user1).deposit(ethers.utils.parseUnits("1"), 0);
    });

    it("Create lock", async function () {
      await QubeSwapTokenSC.connect(user4).approve(VEQstSC.address, ethers.constants.MaxUint256);

      let now = (await time.latest()).toString();
      let OneYear = BigNumber.from(now).add(YEAR);

      await VEQstSC.connect(user4).createLock(ethers.utils.parseUnits("1000"), OneYear);

      let userInfoOfUser4InVEQst = await VEQstSC.getUserInfo(user4.address);

      expect(userInfoOfUser4InVEQst.amount).to.deep.eq(ethers.utils.parseUnits("1000"));

      expect(userInfoOfUser4InVEQst.end).to.deep.eq(OneYear.div(WEEK).mul(WEEK));
    });

    it("Create lock, can only lock until future", async function () {
      await QubeSwapTokenSC.connect(user4).approve(VEQstSC.address, ethers.constants.MaxUint256);

      let now = BigNumber.from((await time.latest()).toString());

      await expectRevert(
        VEQstSC.connect(user4).createLock(ethers.utils.parseUnits("1000"), now),
        "_unlockTime too old"
      );
    });

    it("Create lock, can only lock 4 year max", async function () {
      await QubeSwapTokenSC.connect(user4).approve(VEQstSC.address, ethers.constants.MaxUint256);

      let now = (await time.latest()).toString();
      let FourYear = BigNumber.from(now).add(YEAR.mul(4)).add(WEEK.mul(3));

      await expectRevert(
        VEQstSC.connect(user4).createLock(ethers.utils.parseUnits("1000"), FourYear),
        "_unlockTime too long"
      );
    });

    it("Create lock, amount should be greater than zero", async function () {
      await QubeSwapTokenSC.connect(user4).approve(VEQstSC.address, ethers.constants.MaxUint256);

      let now = (await time.latest()).toString();
      let OneYear = BigNumber.from(now).add(YEAR);

      await expectRevert(VEQstSC.connect(user4).createLock(0, OneYear), "Bad _amount");
    });

    it("Create lock, can not lock when already lock", async function () {
      await QubeSwapTokenSC.connect(user4).approve(VEQstSC.address, ethers.constants.MaxUint256);

      let now = (await time.latest()).toString();
      let OneYear = BigNumber.from(now).add(YEAR);

      VEQstSC.connect(user4).createLock(ethers.utils.parseUnits("1000"), OneYear);

      await expectRevert(
        VEQstSC.connect(user4).createLock(ethers.utils.parseUnits("1000"), OneYear),
        "Already locked"
      );
    });

    it("Increase Lock Amount", async function () {
      await QubeSwapTokenSC.connect(user4).approve(VEQstSC.address, ethers.constants.MaxUint256);

      let now = (await time.latest()).toString();
      let OneYear = BigNumber.from(now).add(YEAR);

      await VEQstSC.connect(user4).createLock(ethers.utils.parseUnits("1000"), OneYear);

      let userInfoOfUser4InVEQstBefore = await VEQstSC.getUserInfo(user4.address);

      await VEQstSC.connect(user4).increaseLockAmount(ethers.utils.parseUnits("66.66"));

      let userInfoOfUser4InVEQstAfter = await VEQstSC.getUserInfo(user4.address);

      expect(userInfoOfUser4InVEQstAfter.amount.sub(userInfoOfUser4InVEQstBefore.amount)).to.deep.eq(
        ethers.utils.parseUnits("66.66")
      );
    });

    it("Increase Unlock Time", async function () {
      await QubeSwapTokenSC.connect(user4).approve(VEQstSC.address, ethers.constants.MaxUint256);

      let now = (await time.latest()).toString();
      let OneYear = BigNumber.from(now).add(YEAR);

      await VEQstSC.connect(user4).createLock(ethers.utils.parseUnits("1000"), OneYear);

      await time.increase(YEAR.div(2).toNumber());

      let newUnlockTime = OneYear.add(YEAR.div(2));

      await VEQstSC.connect(user4).increaseUnlockTime(newUnlockTime);

      let userInfoOfUser4InVEQst = await VEQstSC.getUserInfo(user4.address);

      expect(userInfoOfUser4InVEQst.end).to.deep.eq(newUnlockTime.div(WEEK).mul(WEEK));
    });

    it("Can not Withdraw before lock expired", async function () {
      await QubeSwapTokenSC.connect(user4).approve(VEQstSC.address, ethers.constants.MaxUint256);

      let now = (await time.latest()).toString();
      let OneYear = BigNumber.from(now).add(YEAR);

      await VEQstSC.connect(user4).createLock(ethers.utils.parseUnits("1000"), OneYear);

      await expectRevert(VEQstSC.connect(user4).withdrawAll(user4.address), "Lock not expired");
    });

    it("Withdraw after lock expired", async function () {
      await QubeSwapTokenSC.connect(user4).approve(VEQstSC.address, ethers.constants.MaxUint256);

      let now = (await time.latest()).toString();
      let OneYear = BigNumber.from(now).add(YEAR);

      await VEQstSC.connect(user4).createLock(ethers.utils.parseUnits("1000"), OneYear);

      await time.increaseTo(OneYear.add(WEEK).toNumber());

      let qstBalanceBeforeOfUser4 = await QubeSwapTokenSC.balanceOf(user4.address);

      await VEQstSC.connect(user4).withdrawAll(user4.address);

      let qstBalanceAfterOfUser4 = await QubeSwapTokenSC.balanceOf(user4.address);

      let userInfoOfUser4InVEQst = await VEQstSC.getUserInfo(user4.address);

      expect(qstBalanceAfterOfUser4.sub(qstBalanceBeforeOfUser4)).to.deep.eq(ethers.utils.parseUnits("1000"));
      expect(userInfoOfUser4InVEQst.amount).to.deep.eq(ZERO);
      expect(userInfoOfUser4InVEQst.end).to.deep.eq(ZERO);
    });

    it("Early Withdraw before lock expired", async function () {
      await VEQstSC.setEarlyWithdrawSwitch(true);

      await QubeSwapTokenSC.connect(user4).approve(VEQstSC.address, ethers.constants.MaxUint256);

      let now = (await time.latest()).toString();
      let OneYear = BigNumber.from(now).add(YEAR);

      await VEQstSC.connect(user4).createLock(ethers.utils.parseUnits("1000"), OneYear);

      let qstBalanceBeforeOfUser4 = await QubeSwapTokenSC.balanceOf(user4.address);

      await VEQstSC.connect(user4).earlyWithdraw(user4.address, ethers.utils.parseUnits("88.88"));

      let qstBalanceAfterOfUser4 = await QubeSwapTokenSC.balanceOf(user4.address);

      let userInfoOfUser4InVEQst = await VEQstSC.getUserInfo(user4.address);

      expect(qstBalanceAfterOfUser4.sub(qstBalanceBeforeOfUser4)).to.deep.eq(ethers.utils.parseUnits("88.88"));
      expect(userInfoOfUser4InVEQst.amount).to.deep.eq(
        ethers.utils.parseUnits("1000").sub(ethers.utils.parseUnits("88.88"))
      );
    });

    it("Can not Early Withdraw after lock expired", async function () {
      await VEQstSC.setEarlyWithdrawSwitch(true);

      await QubeSwapTokenSC.connect(user4).approve(VEQstSC.address, ethers.constants.MaxUint256);

      let now = (await time.latest()).toString();
      let OneYear = BigNumber.from(now).add(YEAR);

      await VEQstSC.connect(user4).createLock(ethers.utils.parseUnits("1000"), OneYear);

      await time.increaseTo(OneYear.add(WEEK).toNumber());

      await expectRevert(
        VEQstSC.connect(user4).earlyWithdraw(user4.address, ethers.utils.parseUnits("10")),
        "Too late"
      );
    });
  });

  describe("Comparison between migrated users and normal users", () => {
    beforeEach(async function () {
      // stop emission in qst pool
      await masterChefV2.set(2, 0, true);
      await masterChefV2.set(3, 1, true);
      // update qst pool
      await QstPoolSC.connect(user1).deposit(ethers.utils.parseUnits("1"), 0);
    });

    it("Same LockedBalance", async function () {
      // migrate from qst pool
      await VEQstSC.connect(user2).migrateFromQstPool();

      let userInfoOfUser2InVEQst = await VEQstSC.getUserInfo(user2.address);

      // lock with same qst amount and end time
      await QubeSwapTokenSC.connect(user4).approve(VEQstSC.address, ethers.constants.MaxUint256);
      await VEQstSC.connect(user4).createLock(userInfoOfUser2InVEQst.qstAmount, userInfoOfUser2InVEQst.lockEndTime);

      let LockedBalanceOfUser2InVEQst = await VEQstSC.locks(userInfoOfUser2InVEQst.qstPoolProxy);
      let LockedBalanceOfUser4InVEQst = await VEQstSC.locks(user4.address);

      expect(LockedBalanceOfUser2InVEQst.amount).to.deep.eq(LockedBalanceOfUser4InVEQst.amount);
      expect(LockedBalanceOfUser2InVEQst.end).to.deep.eq(LockedBalanceOfUser4InVEQst.end);
    });

    it("Same balanceOf", async function () {
      // migrate from qst pool
      await VEQstSC.connect(user2).migrateFromQstPool();

      let userInfoOfUser2InVEQst = await VEQstSC.getUserInfo(user2.address);

      // lock with same qst amount and end time
      await QubeSwapTokenSC.connect(user4).approve(VEQstSC.address, ethers.constants.MaxUint256);
      await VEQstSC.connect(user4).createLock(userInfoOfUser2InVEQst.qstAmount, userInfoOfUser2InVEQst.lockEndTime);

      let balanceOfUser2 = await VEQstSC.balanceOf(user2.address);
      let balanceOfUser4 = await VEQstSC.balanceOf(user4.address);
      expect(balanceOfUser2).to.deep.eq(balanceOfUser4);
    });

    it("Same balanceOfAt , and balanceOfAt gradually decreases to zero", async function () {
      // migrate from qst pool
      await VEQstSC.connect(user2).migrateFromQstPool();

      let userInfoOfUser2InVEQst = await VEQstSC.getUserInfo(user2.address);

      // lock with same qst amount and end time
      await QubeSwapTokenSC.connect(user4).approve(VEQstSC.address, ethers.constants.MaxUint256);
      await VEQstSC.connect(user4).createLock(userInfoOfUser2InVEQst.qstAmount, userInfoOfUser2InVEQst.lockEndTime);
      let now = BigNumber.from((await time.latest()).toString());
      let nextWeek = now.add(WEEK);
      // first week
      let currentBlockNumber = BigNumber.from((await time.latestBlock()).toString());
      let balanceOfAtUser2 = await VEQstSC.balanceOfAt(user2.address, currentBlockNumber);
      let balanceOfAtUser4 = await VEQstSC.balanceOfAt(user4.address, currentBlockNumber);
      console.log("First week", balanceOfAtUser2.toString());
      expect(balanceOfAtUser2).to.deep.eq(balanceOfAtUser4);

      let beforeBalance = balanceOfAtUser2;

      // second week
      await time.increaseTo(nextWeek.toNumber());
      nextWeek = now.add(WEEK.mul(2));
      currentBlockNumber = BigNumber.from((await time.latestBlock()).toString());
      let secondWeekBlockNumber = currentBlockNumber;
      balanceOfAtUser2 = await VEQstSC.balanceOfAt(user2.address, currentBlockNumber);
      balanceOfAtUser4 = await VEQstSC.balanceOfAt(user4.address, currentBlockNumber);
      console.log("Second week", balanceOfAtUser2.toString());
      expect(balanceOfAtUser2).to.deep.eq(balanceOfAtUser4);
      expect(Number(beforeBalance)).to.gt(Number(balanceOfAtUser2));
      beforeBalance = balanceOfAtUser2;

      // third week
      await time.increaseTo(nextWeek.toNumber());
      currentBlockNumber = BigNumber.from((await time.latestBlock()).toString());
      balanceOfAtUser2 = await VEQstSC.balanceOfAt(user2.address, currentBlockNumber);
      balanceOfAtUser4 = await VEQstSC.balanceOfAt(user4.address, currentBlockNumber);
      console.log("third week", balanceOfAtUser2.toString());
      expect(balanceOfAtUser2).to.deep.eq(balanceOfAtUser4);
      expect(Number(beforeBalance)).to.gt(Number(balanceOfAtUser2));
      beforeBalance = balanceOfAtUser2;

      // tenth week
      nextWeek = now.add(WEEK.mul(10));
      await time.increaseTo(nextWeek.toNumber());
      currentBlockNumber = BigNumber.from((await time.latestBlock()).toString());
      balanceOfAtUser2 = await VEQstSC.balanceOfAt(user2.address, currentBlockNumber);
      balanceOfAtUser4 = await VEQstSC.balanceOfAt(user4.address, currentBlockNumber);
      console.log("tenth week", balanceOfAtUser2.toString());
      expect(balanceOfAtUser2).to.deep.eq(balanceOfAtUser4);
      expect(Number(beforeBalance)).to.gt(Number(balanceOfAtUser2));
      beforeBalance = balanceOfAtUser2;

      // twentieth week
      nextWeek = now.add(WEEK.mul(20));
      await time.increaseTo(nextWeek.toNumber());
      currentBlockNumber = BigNumber.from((await time.latestBlock()).toString());
      balanceOfAtUser2 = await VEQstSC.balanceOfAt(user2.address, currentBlockNumber);
      balanceOfAtUser4 = await VEQstSC.balanceOfAt(user4.address, currentBlockNumber);
      console.log("twentieth week", balanceOfAtUser2.toString());
      expect(balanceOfAtUser2).to.deep.eq(balanceOfAtUser4);
      expect(Number(beforeBalance)).to.gt(Number(balanceOfAtUser2));
      beforeBalance = balanceOfAtUser2;

      // forty week
      nextWeek = now.add(WEEK.mul(40));
      await time.increaseTo(nextWeek.toNumber());
      currentBlockNumber = BigNumber.from((await time.latestBlock()).toString());
      balanceOfAtUser2 = await VEQstSC.balanceOfAt(user2.address, currentBlockNumber);
      balanceOfAtUser4 = await VEQstSC.balanceOfAt(user4.address, currentBlockNumber);
      console.log("forty week", balanceOfAtUser2.toString());
      expect(balanceOfAtUser2).to.deep.eq(balanceOfAtUser4);
      expect(Number(beforeBalance)).to.gt(Number(balanceOfAtUser2));
      beforeBalance = balanceOfAtUser2;

      // lock expired
      nextWeek = now.add(WEEK.mul(60));
      await time.increaseTo(nextWeek.toNumber());
      currentBlockNumber = BigNumber.from((await time.latestBlock()).toString());
      balanceOfAtUser2 = await VEQstSC.balanceOfAt(user2.address, currentBlockNumber);
      balanceOfAtUser4 = await VEQstSC.balanceOfAt(user4.address, currentBlockNumber);
      console.log("lock expired", balanceOfAtUser2.toString());
      expect(balanceOfAtUser2).to.deep.eq(ZERO);
      expect(balanceOfAtUser2).to.deep.eq(balanceOfAtUser4);
      expect(Number(beforeBalance)).to.gt(Number(balanceOfAtUser2));
    });
  });

  describe("Migrated users can lock as normal users", () => {
    beforeEach(async function () {
      // stop emission in qst pool
      await masterChefV2.set(2, 0, true);
      await masterChefV2.set(3, 1, true);
      // update qst pool
      await QstPoolSC.connect(user1).deposit(ethers.utils.parseUnits("1"), 0);
      // migrate from qst pool
      await VEQstSC.connect(user2).migrateFromQstPool();

      await QubeSwapTokenSC.connect(user2).approve(VEQstSC.address, ethers.constants.MaxUint256);
    });
    it("Create lock", async function () {
      let userInfoOfUser2InVEQst = await VEQstSC.getUserInfo(user2.address);

      let now = (await time.latest()).toString();
      let OneYear = BigNumber.from(now).add(YEAR);
      let lockAmount = ethers.utils.parseUnits("666");
      await VEQstSC.connect(user2).createLock(lockAmount, OneYear);

      userInfoOfUser2InVEQst = await VEQstSC.getUserInfo(user2.address);

      expect(userInfoOfUser2InVEQst.amount).to.deep.eq(lockAmount);
      expect(userInfoOfUser2InVEQst.end).to.deep.eq(OneYear.div(WEEK).mul(WEEK));
    });

    it("Increase Lock Amount", async function () {
      let now = (await time.latest()).toString();
      let OneYear = BigNumber.from(now).add(YEAR);
      let lockAmount = ethers.utils.parseUnits("666");
      await VEQstSC.connect(user2).createLock(lockAmount, OneYear);

      let userInfoOfUser2InVEQstBefore = await VEQstSC.getUserInfo(user2.address);

      let increaseAmount = ethers.utils.parseUnits("66.66");
      await VEQstSC.connect(user2).increaseLockAmount(increaseAmount);

      let userInfoOfUser2InVEQstAfter = await VEQstSC.getUserInfo(user2.address);

      expect(userInfoOfUser2InVEQstAfter.amount.sub(userInfoOfUser2InVEQstBefore.amount)).to.deep.eq(increaseAmount);
    });

    it("Increase Unlock Time", async function () {
      let now = (await time.latest()).toString();
      let OneYear = BigNumber.from(now).add(YEAR);
      let lockAmount = ethers.utils.parseUnits("666");
      await VEQstSC.connect(user2).createLock(lockAmount, OneYear);

      await time.increase(YEAR.div(2).toNumber());

      let newUnlockTime = OneYear.add(YEAR.div(2));

      await VEQstSC.connect(user2).increaseUnlockTime(newUnlockTime);

      let userInfoOfUser2InVEQst = await VEQstSC.getUserInfo(user2.address);

      expect(userInfoOfUser2InVEQst.end).to.deep.eq(newUnlockTime.div(WEEK).mul(WEEK));
    });

    it("Withdraw after lock expired", async function () {
      let now = (await time.latest()).toString();
      let OneYear = BigNumber.from(now).add(YEAR);
      let lockAmount = ethers.utils.parseUnits("666");
      await VEQstSC.connect(user2).createLock(lockAmount, OneYear);

      await time.increaseTo(OneYear.add(WEEK).toNumber());

      let qstBalanceBeforeOfUser2 = await QubeSwapTokenSC.balanceOf(user2.address);

      await VEQstSC.connect(user2).withdrawAll(user2.address);

      let qstBalanceAfterOfUser2 = await QubeSwapTokenSC.balanceOf(user2.address);

      let userInfoOfUser2InVEQst = await VEQstSC.getUserInfo(user2.address);

      expect(qstBalanceAfterOfUser2.sub(qstBalanceBeforeOfUser2)).to.deep.eq(lockAmount);
      expect(userInfoOfUser2InVEQst.amount).to.deep.eq(ZERO);
      expect(userInfoOfUser2InVEQst.end).to.deep.eq(ZERO);
    });

    it("User balanceOf should be equal to the sum of user address and proxy address ", async function () {
      let now = (await time.latest()).toString();
      let OneYear = BigNumber.from(now).add(YEAR);
      let lockAmount = ethers.utils.parseUnits("666");
      await VEQstSC.connect(user2).createLock(lockAmount, OneYear);

      let userInfoOfUser2InVEQst = await VEQstSC.getUserInfo(user2.address);
      let balanceOfUser2 = await VEQstSC.balanceOfUser(user2.address);
      let balanceOfUser2Proxy = await VEQstSC.balanceOfUser(userInfoOfUser2InVEQst.qstPoolProxy);
      let totalBalanceOfUser2 = await VEQstSC.balanceOf(user2.address);

      expect(balanceOfUser2.add(balanceOfUser2Proxy)).to.deep.eq(totalBalanceOfUser2);
    });

    it("User balanceOfAt should be equal to the sum of user address and proxy address ", async function () {
      let now = (await time.latest()).toString();
      let OneYear = BigNumber.from(now).add(YEAR);
      let lockAmount = ethers.utils.parseUnits("666");
      await VEQstSC.connect(user2).createLock(lockAmount, OneYear);

      let userInfoOfUser2InVEQst = await VEQstSC.getUserInfo(user2.address);

      now = BigNumber.from((await time.latest()).toString());
      let nextWeek = now.add(WEEK);

      // first week
      let currentBlockNumber = BigNumber.from((await time.latestBlock()).toString());
      let balanceOfAtUser2 = await VEQstSC.balanceOfAtUser(user2.address, currentBlockNumber);
      let balanceOfAtUser2Proxy = await VEQstSC.balanceOfAtUser(
        userInfoOfUser2InVEQst.qstPoolProxy,
        currentBlockNumber
      );
      let totalBalanceOfAtUser2 = await VEQstSC.balanceOfAt(user2.address, currentBlockNumber);

      expect(balanceOfAtUser2.add(balanceOfAtUser2Proxy)).to.deep.eq(totalBalanceOfAtUser2);

      // second week
      await time.increaseTo(nextWeek.toNumber());
      nextWeek = now.add(WEEK.mul(2));
      currentBlockNumber = BigNumber.from((await time.latestBlock()).toString());
      balanceOfAtUser2 = await VEQstSC.balanceOfAtUser(user2.address, currentBlockNumber);
      balanceOfAtUser2Proxy = await VEQstSC.balanceOfAtUser(userInfoOfUser2InVEQst.qstPoolProxy, currentBlockNumber);
      totalBalanceOfAtUser2 = await VEQstSC.balanceOfAt(user2.address, currentBlockNumber);
      expect(balanceOfAtUser2.add(balanceOfAtUser2Proxy)).to.deep.eq(totalBalanceOfAtUser2);

      // tenth week
      nextWeek = now.add(WEEK.mul(10));
      await time.increaseTo(nextWeek.toNumber());
      currentBlockNumber = BigNumber.from((await time.latestBlock()).toString());
      balanceOfAtUser2 = await VEQstSC.balanceOfAtUser(user2.address, currentBlockNumber);
      balanceOfAtUser2Proxy = await VEQstSC.balanceOfAtUser(userInfoOfUser2InVEQst.qstPoolProxy, currentBlockNumber);
      totalBalanceOfAtUser2 = await VEQstSC.balanceOfAt(user2.address, currentBlockNumber);
      expect(balanceOfAtUser2.add(balanceOfAtUser2Proxy)).to.deep.eq(totalBalanceOfAtUser2);

      // forty week
      nextWeek = now.add(WEEK.mul(40));
      await time.increaseTo(nextWeek.toNumber());
      currentBlockNumber = BigNumber.from((await time.latestBlock()).toString());
      balanceOfAtUser2 = await VEQstSC.balanceOfAtUser(user2.address, currentBlockNumber);
      balanceOfAtUser2Proxy = await VEQstSC.balanceOfAtUser(userInfoOfUser2InVEQst.qstPoolProxy, currentBlockNumber);
      totalBalanceOfAtUser2 = await VEQstSC.balanceOfAt(user2.address, currentBlockNumber);
      expect(balanceOfAtUser2.add(balanceOfAtUser2Proxy)).to.deep.eq(totalBalanceOfAtUser2);

      // lock expired
      nextWeek = now.add(WEEK.mul(60));
      await time.increaseTo(nextWeek.toNumber());
      currentBlockNumber = BigNumber.from((await time.latestBlock()).toString());

      balanceOfAtUser2 = await VEQstSC.balanceOfAtUser(user2.address, currentBlockNumber);
      balanceOfAtUser2Proxy = await VEQstSC.balanceOfAtUser(userInfoOfUser2InVEQst.qstPoolProxy, currentBlockNumber);
      totalBalanceOfAtUser2 = await VEQstSC.balanceOfAt(user2.address, currentBlockNumber);
      expect(balanceOfAtUser2.add(balanceOfAtUser2Proxy)).to.deep.eq(totalBalanceOfAtUser2);
      expect(balanceOfAtUser2).to.deep.eq(ZERO);
      expect(balanceOfAtUser2Proxy).to.deep.eq(ZERO);
      expect(totalBalanceOfAtUser2).to.deep.eq(ZERO);
    });
  });

  describe("Owner operations", () => {
    beforeEach(async function () {
      // stop emission in qst pool
      await masterChefV2.set(2, 0, true);
      await masterChefV2.set(3, 1, true);
      // update qst pool
      await QstPoolSC.connect(user1).deposit(ethers.utils.parseUnits("1"), 0);
    });

    it("Set Early Withdraw", async function () {
      await QubeSwapTokenSC.connect(user4).approve(VEQstSC.address, ethers.constants.MaxUint256);

      let now = (await time.latest()).toString();
      let OneYear = BigNumber.from(now).add(YEAR);

      await VEQstSC.connect(user4).createLock(ethers.utils.parseUnits("1000"), OneYear);

      let qstBalanceBeforeOfUser4 = await QubeSwapTokenSC.balanceOf(user4.address);

      await expectRevert(
        VEQstSC.connect(user4).earlyWithdraw(user4.address, ethers.utils.parseUnits("88.88")),
        "Forbid"
      );

      await VEQstSC.setEarlyWithdrawSwitch(true);

      await VEQstSC.connect(user4).earlyWithdraw(user4.address, ethers.utils.parseUnits("88.88"));

      let qstBalanceAfterOfUser4 = await QubeSwapTokenSC.balanceOf(user4.address);

      let userInfoOfUser4InVEQst = await VEQstSC.getUserInfo(user4.address);

      expect(qstBalanceAfterOfUser4.sub(qstBalanceBeforeOfUser4)).to.deep.eq(ethers.utils.parseUnits("88.88"));
      expect(userInfoOfUser4InVEQst.amount).to.deep.eq(
        ethers.utils.parseUnits("1000").sub(ethers.utils.parseUnits("88.88"))
      );
    });

    it("Set Limit Time Of Convert", async function () {
      let limitTimeOfConvert = await VEQstSC.limitTimeOfConvert();
      expect(limitTimeOfConvert).to.deep.eq(WEEK.mul(2));

      await VEQstSC.setLimitTimeOfConvert(WEEK.mul(6));
      limitTimeOfConvert = await VEQstSC.limitTimeOfConvert();
      expect(limitTimeOfConvert).to.deep.eq(WEEK.mul(6));
    });

    it("Set Early Withdraw Config", async function () {
      await QubeSwapTokenSC.connect(user4).approve(VEQstSC.address, ethers.constants.MaxUint256);

      let now = (await time.latest()).toString();
      let OneYear = BigNumber.from(now).add(YEAR);

      await VEQstSC.connect(user4).createLock(ethers.utils.parseUnits("1000"), OneYear);

      let qstBalanceBeforeOfUser4 = await QubeSwapTokenSC.balanceOf(user4.address);

      await VEQstSC.setEarlyWithdrawSwitch(true);
      const newEarlyWithdrawBpsPerWeek = 100; // 1%
      const newRedistributeBps = 4000; // 40%
      const newTreasuryAddr = treasury.address;
      const newRedistributeAddr = redistributor.address;
      await VEQstSC.setEarlyWithdrawConfig(
        newEarlyWithdrawBpsPerWeek,
        newRedistributeBps,
        newTreasuryAddr,
        newRedistributeAddr
      );

      // ceil the week by adding 1 week first
      // uint256 remainingWeeks = (_prevLockEnd + WEEK - block.timestamp) / WEEK;
      // // calculate penalty
      // _penalty = (earlyWithdrawBpsPerWeek * remainingWeeks * _amount) / 10000;
      // // split penalty into two parts
      // uint256 _redistribute = (_penalty * redistributeBps) / 10000;
      const earlyWithdrawAmount = ethers.utils.parseUnits("100");
      let LockedBalanceOfUser4InVEQst = await VEQstSC.locks(user4.address);
      let currentTimestamp = BigNumber.from((await time.latest()).toString());
      let remainingWeeks = BigNumber.from(LockedBalanceOfUser4InVEQst.end).add(WEEK).sub(currentTimestamp).div(WEEK);
      const penalty = BigNumber.from(newEarlyWithdrawBpsPerWeek)
        .mul(remainingWeeks)
        .mul(earlyWithdrawAmount)
        .div(10000);

      // split penalty into two parts
      // uint256 _redistribute = (_penalty * redistributeBps) / 10000;
      const redistributeQstAmount = penalty.mul(BigNumber.from(newRedistributeBps)).div(10000);

      await VEQstSC.connect(user4).earlyWithdraw(user4.address, earlyWithdrawAmount);

      const qstBalanceOfTreasury = await QubeSwapTokenSC.balanceOf(treasury.address);
      const accumRedistribute = await VEQstSC.accumRedistribute();

      let qstBalanceAfterOfUser4 = await QubeSwapTokenSC.balanceOf(user4.address);

      let userInfoOfUser4InVEQst = await VEQstSC.getUserInfo(user4.address);

      expect(accumRedistribute).to.deep.eq(redistributeQstAmount);
      expect(qstBalanceOfTreasury).to.deep.eq(penalty.sub(redistributeQstAmount));
      expect(qstBalanceAfterOfUser4.sub(qstBalanceBeforeOfUser4)).to.deep.eq(earlyWithdrawAmount.sub(penalty));
      expect(userInfoOfUser4InVEQst.amount).to.deep.eq(ethers.utils.parseUnits("1000").sub(earlyWithdrawAmount));
    });

    it("redistribute, and Set Whitelisted Redistributors", async function () {
      await QubeSwapTokenSC.connect(user4).approve(VEQstSC.address, ethers.constants.MaxUint256);

      let now = (await time.latest()).toString();
      let OneYear = BigNumber.from(now).add(YEAR);

      await VEQstSC.connect(user4).createLock(ethers.utils.parseUnits("1000"), OneYear);

      let qstBalanceBeforeOfUser4 = await QubeSwapTokenSC.balanceOf(user4.address);

      await VEQstSC.setEarlyWithdrawSwitch(true);
      const newEarlyWithdrawBpsPerWeek = 100; // 1%
      const newRedistributeBps = 4000; // 40%
      const newTreasuryAddr = treasury.address;
      const newRedistributeAddr = redistributor.address;
      await VEQstSC.setEarlyWithdrawConfig(
        newEarlyWithdrawBpsPerWeek,
        newRedistributeBps,
        newTreasuryAddr,
        newRedistributeAddr
      );

      const earlyWithdrawAmount = ethers.utils.parseUnits("100");
      let LockedBalanceOfUser4InVEQst = await VEQstSC.locks(user4.address);
      let currentTimestamp = BigNumber.from((await time.latest()).toString());
      let remainingWeeks = BigNumber.from(LockedBalanceOfUser4InVEQst.end).add(WEEK).sub(currentTimestamp).div(WEEK);
      const penalty = BigNumber.from(newEarlyWithdrawBpsPerWeek)
        .mul(remainingWeeks)
        .mul(earlyWithdrawAmount)
        .div(10000);

      const redistributeQstAmount = penalty.mul(BigNumber.from(newRedistributeBps)).div(10000);

      await VEQstSC.connect(user4).earlyWithdraw(user4.address, earlyWithdrawAmount);

      const qstBalanceOfTreasury = await QubeSwapTokenSC.balanceOf(treasury.address);
      let accumRedistribute = await VEQstSC.accumRedistribute();

      await expectRevert(VEQstSC.connect(redistributor).redistribute(), "! wl redistributors");

      await VEQstSC.setWhitelistedRedistributors([redistributor.address], true);
      await VEQstSC.connect(redistributor).redistribute();
      const qstBalanceOfRedistributor = await QubeSwapTokenSC.balanceOf(redistributor.address);

      expect(qstBalanceOfRedistributor).to.deep.eq(redistributeQstAmount);
      expect(qstBalanceOfRedistributor).to.deep.eq(accumRedistribute);
      accumRedistribute = await VEQstSC.accumRedistribute();
      expect(accumRedistribute).to.deep.eq(ZERO);
    });

    it("Set No Penalty For Early Withdraw", async function () {
      await QubeSwapTokenSC.connect(user4).approve(VEQstSC.address, ethers.constants.MaxUint256);

      let now = (await time.latest()).toString();
      let OneYear = BigNumber.from(now).add(YEAR);

      await VEQstSC.connect(user4).createLock(ethers.utils.parseUnits("1000"), OneYear);

      let qstBalanceBeforeOfUser4 = await QubeSwapTokenSC.balanceOf(user4.address);

      await VEQstSC.setEarlyWithdrawSwitch(true);
      const newEarlyWithdrawBpsPerWeek = 100; // 1%
      const newRedistributeBps = 4000; // 40%
      const newTreasuryAddr = treasury.address;
      const newRedistributeAddr = redistributor.address;
      await VEQstSC.setEarlyWithdrawConfig(
        newEarlyWithdrawBpsPerWeek,
        newRedistributeBps,
        newTreasuryAddr,
        newRedistributeAddr
      );
      // setNoPenaltyForEarlyWithdraw for user4
      await VEQstSC.setNoPenaltyForEarlyWithdraw(user4.address, true);

      const earlyWithdrawAmount = ethers.utils.parseUnits("100");
      await VEQstSC.connect(user4).earlyWithdraw(user4.address, earlyWithdrawAmount);

      let qstBalanceAfterOfUser4 = await QubeSwapTokenSC.balanceOf(user4.address);

      const qstBalanceOfTreasury = await QubeSwapTokenSC.balanceOf(treasury.address);
      let accumRedistribute = await VEQstSC.accumRedistribute();

      expect(qstBalanceOfTreasury).to.deep.eq(ZERO);
      expect(accumRedistribute).to.deep.eq(ZERO);
      expect(qstBalanceAfterOfUser4.sub(qstBalanceBeforeOfUser4)).to.deep.eq(earlyWithdrawAmount);
    });

    it("Set Emergency Withdraw Switch", async function () {
      await QubeSwapTokenSC.connect(user4).approve(VEQstSC.address, ethers.constants.MaxUint256);

      let now = (await time.latest()).toString();
      let OneYear = BigNumber.from(now).add(YEAR);
      const lockAmount = ethers.utils.parseUnits("1000");
      await VEQstSC.connect(user4).createLock(lockAmount, OneYear);

      let qstBalanceBeforeOfUser4 = await QubeSwapTokenSC.balanceOf(user4.address);

      await expectRevert(VEQstSC.connect(user4).emergencyWithdraw(), "Forbid emergency withdraw");

      await VEQstSC.setEmergencyWithdrawSwitch(true);
      await VEQstSC.connect(user4).emergencyWithdraw();

      let qstBalanceAfterOfUser4 = await QubeSwapTokenSC.balanceOf(user4.address);
      expect(qstBalanceAfterOfUser4.sub(qstBalanceBeforeOfUser4)).to.deep.eq(lockAmount);

      let LockedBalanceOfUser4InVEQst = await VEQstSC.locks(user4.address);

      expect(LockedBalanceOfUser4InVEQst.amount).to.deep.eq(ZERO);
      expect(LockedBalanceOfUser4InVEQst.end).to.deep.eq(ZERO);
    });
  });
});
