import { parseEther } from "ethers/lib/utils";
import { artifacts, contract } from "hardhat";
import { assert } from "chai";
import { BN, expectEvent, expectRevert, time, constants } from "@openzeppelin/test-helpers";

const SmartChefFactory = artifacts.require("./SmartChefFactory");
const SmartChefInitializable = artifacts.require("./SmartChefInitializable");
const MockERC20 = artifacts.require("./libs/MockERC20");
const MockERC721 = artifacts.require("./test/MockERC721");
const QubeProfile = artifacts.require("./test/MockQubeProfile");

contract("Smart Chef Factory", ([alice, bob, carol, david, erin, ...accounts]) => {
  let blockNumber;
  let startBlock;
  let endBlock;

  let poolLimitPerUser = parseEther("0");
  let rewardPerBlock = parseEther("10");

  // Contracts
  let fakeQst, mockQST, mockPT, smartChef, smartChefFactory, mockQubeBunnies, qubeProfile;

  // Generic result variable
  let result: any;

  beforeEach(async () => {
    blockNumber = await time.latestBlock();
    startBlock = new BN(blockNumber).add(new BN(100));
    endBlock = new BN(blockNumber).add(new BN(500));

    mockQST = await MockERC20.new("Mock QST", "QST", parseEther("1000000"), {
      from: alice,
    });

    mockPT = await MockERC20.new("Mock Pool Token 1", "PT1", parseEther("4000"), {
      from: alice,
    });

    // Fake $Qst Token
    fakeQst = await MockERC20.new("FakeSwap", "Fake", parseEther("100"), { from: alice });

    smartChefFactory = await SmartChefFactory.new({ from: alice });

    // Qube Bunnies / Profile setup
    mockQubeBunnies = await MockERC721.new("Qube Bunnies", "PB", { from: alice });
    qubeProfile = await QubeProfile.new(mockQST.address, parseEther("2"), parseEther("1"), parseEther("2"), {
      from: alice,
    });

    let POINT_ROLE = await qubeProfile.POINT_ROLE();
    result = await qubeProfile.grantRole(POINT_ROLE, alice, {
      from: alice,
    });

    await qubeProfile.addTeam("1st Team", "Be a Chef!", { from: alice });
    await qubeProfile.addNftAddress(mockQubeBunnies.address, { from: alice });
  });

  describe("SMART CHEF #2 - Extra Tests", async () => {
    it("1.No profile, points, QST limit requirements set.", async () => {
      result = await smartChefFactory.deployPool(
        mockQST.address,
        mockPT.address,
        rewardPerBlock,
        startBlock,
        endBlock,
        poolLimitPerUser,
        0,
        qubeProfile.address,
        false,
        0,
        alice
      );

      const poolAddress = result.receipt.logs[2].args[0];

      expectEvent(result, "NewSmartChefContract", { smartChef: poolAddress });

      smartChef = await SmartChefInitializable.at(poolAddress);

      // Transfer 4000 PT token to the contract (400 blocks with 10 PT/block)
      await mockPT.transfer(smartChef.address, parseEther("4000"), { from: alice });

      let i = 0;
      for (let thisUser of [bob, carol, david, erin]) {
        await mockQST.mintTokens(parseEther("1000"), { from: thisUser });
        await mockQST.approve(smartChef.address, parseEther("1000"), {
          from: thisUser,
        });
        result = await smartChef.deposit(parseEther("100"), { from: thisUser });
        expectEvent(result, "Deposit", { user: thisUser, amount: String(parseEther("100")) });
        i++;
      }
    });

    it("2.Profile requirement is true. No points or QST limit requirements set.", async () => {
      result = await smartChefFactory.deployPool(
        mockQST.address,
        mockPT.address,
        rewardPerBlock,
        startBlock,
        endBlock,
        poolLimitPerUser,
        0,
        qubeProfile.address,
        true,
        0,
        alice
      );

      const poolAddress = result.receipt.logs[2].args[0];

      expectEvent(result, "NewSmartChefContract", { smartChef: poolAddress });

      smartChef = await SmartChefInitializable.at(poolAddress);

      // Transfer 4000 PT token to the contract (400 blocks with 10 PT/block)
      await mockPT.transfer(smartChef.address, parseEther("4000"), { from: alice });

      let i = 0;
      for (let thisUser of [bob, carol, david, erin]) {
        await mockQST.mintTokens(parseEther("1000"), { from: thisUser });
        await mockQST.approve(smartChef.address, parseEther("1000"), {
          from: thisUser,
        });
        await expectRevert(
          smartChef.deposit(parseEther("100"), { from: thisUser }),
          "Deposit: Must have an active profile"
        );
        i++;
      }
    });

    it("3.Profile requirement is true. No points or QST limit requirements set.", async () => {
      result = await smartChefFactory.deployPool(
        mockQST.address,
        mockPT.address,
        rewardPerBlock,
        startBlock,
        endBlock,
        poolLimitPerUser,
        0,
        qubeProfile.address,
        true,
        0,
        alice
      );

      const poolAddress = result.receipt.logs[2].args[0];

      expectEvent(result, "NewSmartChefContract", { smartChef: poolAddress });

      smartChef = await SmartChefInitializable.at(poolAddress);

      // Transfer 4000 PT token to the contract (400 blocks with 10 PT/block)
      await mockPT.transfer(smartChef.address, parseEther("4000"), { from: alice });

      let i = 0;
      for (let thisUser of [bob, carol, david, erin]) {
        await mockQST.mintTokens(parseEther("1000"), { from: thisUser });
        await mockQST.approve(smartChef.address, parseEther("1000"), {
          from: thisUser,
        });
        await mockQubeBunnies.mint({ from: thisUser });
        await mockQubeBunnies.setApprovalForAll(qubeProfile.address, true, { from: thisUser });
        await mockQST.approve(qubeProfile.address, constants.MAX_UINT256, { from: thisUser });
        await qubeProfile.createProfile("1", mockQubeBunnies.address, i.toString(), { from: thisUser });

        result = await smartChef.deposit(parseEther("100"), { from: thisUser });
        expectEvent(result, "Deposit", { user: thisUser, amount: String(parseEther("100")) });
        i++;
      }
    });

    it("4.Profile requirement is true. Points requirement set to 1000.", async () => {
      result = await smartChefFactory.deployPool(
        mockQST.address,
        mockPT.address,
        rewardPerBlock,
        startBlock,
        endBlock,
        poolLimitPerUser,
        0,
        qubeProfile.address,
        true,
        1000,
        alice
      );

      const poolAddress = result.receipt.logs[2].args[0];

      expectEvent(result, "NewSmartChefContract", { smartChef: poolAddress });

      smartChef = await SmartChefInitializable.at(poolAddress);

      // Transfer 4000 PT token to the contract (400 blocks with 10 PT/block)
      await mockPT.transfer(smartChef.address, parseEther("4000"), { from: alice });

      let i = 0;
      for (let thisUser of [bob, carol, david, erin]) {
        await mockQST.mintTokens(parseEther("1000"), { from: thisUser });
        await mockQST.approve(smartChef.address, parseEther("1000"), {
          from: thisUser,
        });
        await mockQubeBunnies.mint({ from: thisUser });
        await mockQubeBunnies.setApprovalForAll(qubeProfile.address, true, { from: thisUser });
        await mockQST.approve(qubeProfile.address, constants.MAX_UINT256, { from: thisUser });
        await qubeProfile.createProfile("1", mockQubeBunnies.address, i.toString(), { from: thisUser });

        await expectRevert(
          smartChef.deposit(parseEther("100"), { from: thisUser }),
          "Deposit: User is not get enough user points"
        );
        i++;
      }
    });

    it("5.Profile requirement is true. Points requirement set to 1000.", async () => {
      result = await smartChefFactory.deployPool(
        mockQST.address,
        mockPT.address,
        rewardPerBlock,
        startBlock,
        endBlock,
        poolLimitPerUser,
        0,
        qubeProfile.address,
        true,
        1000,
        alice
      );

      const poolAddress = result.receipt.logs[2].args[0];

      expectEvent(result, "NewSmartChefContract", { smartChef: poolAddress });

      smartChef = await SmartChefInitializable.at(poolAddress);

      // Transfer 4000 PT token to the contract (400 blocks with 10 PT/block)
      await mockPT.transfer(smartChef.address, parseEther("4000"), { from: alice });

      let i = 0;
      for (let thisUser of [bob, carol, david, erin]) {
        await mockQST.mintTokens(parseEther("1000"), { from: thisUser });
        await mockQST.approve(smartChef.address, parseEther("1000"), {
          from: thisUser,
        });
        await mockQubeBunnies.mint({ from: thisUser });
        await mockQubeBunnies.setApprovalForAll(qubeProfile.address, true, { from: thisUser });
        await mockQST.approve(qubeProfile.address, constants.MAX_UINT256, { from: thisUser });
        await qubeProfile.createProfile("1", mockQubeBunnies.address, i.toString(), { from: thisUser });
        await qubeProfile.increaseUserPoints(thisUser, 1000, 1, { from: alice });
        result = await smartChef.deposit(parseEther("100"), { from: thisUser });
        expectEvent(result, "Deposit", { user: thisUser, amount: String(parseEther("100")) });
        i++;
      }
    });

    it("6.Profile requirement is true. Points requirement set to 1000.", async () => {
      result = await smartChefFactory.deployPool(
        mockQST.address,
        mockPT.address,
        rewardPerBlock,
        startBlock,
        endBlock,
        parseEther("1"),
        100,
        qubeProfile.address,
        true,
        1000,
        alice
      );

      const poolAddress = result.receipt.logs[2].args[0];

      expectEvent(result, "NewSmartChefContract", { smartChef: poolAddress });

      smartChef = await SmartChefInitializable.at(poolAddress);

      // Transfer 4000 PT token to the contract (400 blocks with 10 PT/block)
      await mockPT.transfer(smartChef.address, parseEther("4000"), { from: alice });

      let i = 0;
      for (let thisUser of [bob, carol, david, erin]) {
        await mockQST.mintTokens(parseEther("1000"), { from: thisUser });
        await mockQST.approve(smartChef.address, parseEther("1000"), {
          from: thisUser,
        });
        await expectRevert(
          smartChef.deposit(parseEther("1"), { from: thisUser }),
          "Deposit: Must have an active profile"
        );
        i++;
      }
      await smartChef.updateProfileAndThresholdPointsRequirement(false, 1000, { from: alice });
      i = 0;
      for (let thisUser of [bob, carol, david, erin]) {
        await mockQST.mintTokens(parseEther("1000"), { from: thisUser });
        await mockQST.approve(smartChef.address, parseEther("1000"), {
          from: thisUser,
        });
        await expectRevert(
          smartChef.deposit(parseEther("1"), { from: thisUser }),
          "Deposit: Must have an active profile"
        );
        i++;
      }
      await smartChef.updateProfileAndThresholdPointsRequirement(false, 0, { from: alice });
      i = 0;
      for (let thisUser of [bob, carol, david, erin]) {
        await mockQST.mintTokens(parseEther("1000"), { from: thisUser });
        await mockQST.approve(smartChef.address, parseEther("1000"), {
          from: thisUser,
        });
        result = await smartChef.deposit(parseEther("1"), { from: thisUser });
        expectEvent(result, "Deposit", { user: thisUser, amount: String(parseEther("1")) });
        i++;
      }
      i = 0;
      for (let thisUser of [bob, carol, david, erin]) {
        await mockQST.mintTokens(parseEther("1000"), { from: thisUser });
        await mockQST.approve(smartChef.address, parseEther("1000"), {
          from: thisUser,
        });
        await expectRevert(smartChef.deposit(parseEther("1"), { from: thisUser }), "Deposit: Amount above limit");
        i++;
      }
      await time.advanceBlockTo(startBlock.add(new BN(500)));
      i = 0;
      for (let thisUser of [bob, carol, david, erin]) {
        await mockQST.mintTokens(parseEther("1000"), { from: thisUser });
        await mockQST.approve(smartChef.address, parseEther("1000"), {
          from: thisUser,
        });
        result = await smartChef.deposit(parseEther("1"), { from: thisUser });
        expectEvent(result, "Deposit", { user: thisUser, amount: String(parseEther("1")) });
        i++;
      }
    });
  });
});
