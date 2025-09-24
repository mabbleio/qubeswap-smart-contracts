import { expectRevert, time } from "@openzeppelin/test-helpers";
import { artifacts, contract, ethers } from "hardhat";
import { assert } from "chai";

const QubeSwapToken = artifacts.require("QubeSwapToken");
const MasterChef = artifacts.require("MasterChef");
const MockBEP20 = artifacts.require("libs/MockBEP20");
const Timelock = artifacts.require("Timelock");
const SyrupBar = artifacts.require("SyrupBar");

function encodeParameters(types, values) {
  const abi = new ethers.utils.AbiCoder();
  return abi.encode(types, values);
}

contract("Timelock", ([alice, bob, carol, dev, minter]) => {
  let qst, syrup, lp1, chef, timelock;

  beforeEach(async () => {
    qst = await QubeSwapToken.new({ from: alice });
    timelock = await Timelock.new(bob, "28800", { from: alice }); //8hours
  });

  it("should not allow non-owner to do operation", async () => {
    await qst.transferOwnership(timelock.address, { from: alice });
    await expectRevert(qst.transferOwnership(carol, { from: alice }), "Ownable: caller is not the owner");
    await expectRevert(qst.transferOwnership(carol, { from: bob }), "Ownable: caller is not the owner");
    await expectRevert(
      timelock.queueTransaction(
        qst.address,
        "0",
        "transferOwnership(address)",
        encodeParameters(["address"], [carol]),
        (await time.latest()).add(time.duration.hours(6)),
        { from: alice }
      ),
      "Timelock::queueTransaction: Call must come from admin."
    );
  });

  it("should do the timelock thing", async () => {
    await qst.transferOwnership(timelock.address, { from: alice });
    const eta = (await time.latest()).add(time.duration.hours(9));
    await timelock.queueTransaction(
      qst.address,
      "0",
      "transferOwnership(address)",
      encodeParameters(["address"], [carol]),
      eta,
      { from: bob }
    );
    await time.increase(time.duration.hours(1));
    await expectRevert(
      timelock.executeTransaction(
        qst.address,
        "0",
        "transferOwnership(address)",
        encodeParameters(["address"], [carol]),
        eta,
        { from: bob }
      ),
      "Timelock::executeTransaction: Transaction hasn't surpassed time lock."
    );
    await time.increase(time.duration.hours(8));
    await timelock.executeTransaction(
      qst.address,
      "0",
      "transferOwnership(address)",
      encodeParameters(["address"], [carol]),
      eta,
      { from: bob }
    );
    assert.equal((await qst.owner()).valueOf(), carol);
  });

  it("should also work with MasterChef", async () => {
    lp1 = await MockBEP20.new("LPToken", "LP", "10000000000", { from: minter });
    syrup = await SyrupBar.new(qst.address, { from: minter });
    chef = await MasterChef.new(qst.address, syrup.address, dev, "1000", "0", { from: alice });
    await qst.transferOwnership(chef.address, { from: alice });
    await syrup.transferOwnership(chef.address, { from: minter });
    await chef.add("100", lp1.address, true, { from: alice });
    await chef.transferOwnership(timelock.address, { from: alice });
    await expectRevert(chef.add("100", lp1.address, true, { from: alice }), "Ownable: caller is not the owner");

    const eta = (await time.latest()).add(time.duration.hours(9));
    await timelock.queueTransaction(
      chef.address,
      "0",
      "transferOwnership(address)",
      encodeParameters(["address"], [minter]),
      eta,
      { from: bob }
    );
    await time.increase(time.duration.hours(9));
    await timelock.executeTransaction(
      chef.address,
      "0",
      "transferOwnership(address)",
      encodeParameters(["address"], [minter]),
      eta,
      { from: bob }
    );
    await expectRevert(chef.add("100", lp1.address, true, { from: alice }), "Ownable: caller is not the owner");
    await chef.add("100", lp1.address, true, { from: minter });
  });
});
