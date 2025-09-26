// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

interface IProxyForQstPoolFactory {
    function parameters() external view returns (address VEQst, address user);

    /// @notice Deploy proxy for qst pool
    /// @param _user: Qst pool user
    /// @return proxy The proxy address
    function deploy(address _user) external returns (address proxy);
}
