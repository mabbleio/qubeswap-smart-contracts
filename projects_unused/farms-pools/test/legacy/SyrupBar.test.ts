import { expectRevert, time } from "@openzeppelin/test-helpers";
import { artifacts, contract } from "hardhat";
import { assert } from "chai";

const QubeSwapToken = artifacts.require("QubeSwapToken");
const SyrupBar = artifacts.require("SyrupBar");

contract("SyrupBar", ([alice, bob, minter]) => {
  let qst, syrup;

  beforeEach(async () => {
    qst = await QubeSwapToken.new({ from: minter });
    syrup = await SyrupBar.new(qst.address, { from: minter });
  });

  it("mint", async () => {
    await syrup.mint(alice, 1000, { from: minter });
    assert.equal((await syrup.balanceOf(alice)).toString(), "1000");
  });

  it("burn", async () => {
    await time.advanceBlockTo("650");
    await syrup.mint(alice, 1000, { from: minter });
    await syrup.mint(bob, 1000, { from: minter });
    assert.equal((await syrup.totalSupply()).toString(), "2000");
    await syrup.burn(alice, 200, { from: minter });

    assert.equal((await syrup.balanceOf(alice)).toString(), "800");
    assert.equal((await syrup.totalSupply()).toString(), "1800");
  });

  it("safeQstTransfer", async () => {
    assert.equal((await qst.balanceOf(syrup.address)).toString(), "0");
    await qst.mint(syrup.address, 1000, { from: minter });
    await syrup.safeQstTransfer(bob, 200, { from: minter });
    assert.equal((await qst.balanceOf(bob)).toString(), "200");
    assert.equal((await qst.balanceOf(syrup.address)).toString(), "800");
    await syrup.safeQstTransfer(bob, 2000, { from: minter });
    assert.equal((await qst.balanceOf(bob)).toString(), "1000");
  });
});
