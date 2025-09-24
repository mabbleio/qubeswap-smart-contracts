// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

interface IMasterChefV2 {
    function pendingQst(uint256 _pid, address _user) external view returns (uint256);
}
