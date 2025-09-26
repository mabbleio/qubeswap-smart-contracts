// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "./interfaces/IVEQst.sol";
import "./interfaces/IProxyForQstPoolFactory.sol";

contract ProxyForQstPool {
    IVEQst public immutable VEQst;
    address public immutable qstPoolUser;

    modifier onlyVEQst() {
        require(msg.sender == address(VEQst), "Not VEQst");
        _;
    }

    /// @notice Constructor
    constructor() {
        (address VEQstAddress, address user) = IProxyForQstPoolFactory(msg.sender).parameters();
        VEQst = IVEQst(VEQstAddress);
        qstPoolUser = user;
    }

    function createLockForProxy(uint256 _amount, uint256 _unlockTime) external onlyVEQst {
        VEQst.createLockForProxy(_amount, _unlockTime);
    }

    function withdrawAll() external onlyVEQst {
        VEQst.withdrawAll(address(this));
    }
}
