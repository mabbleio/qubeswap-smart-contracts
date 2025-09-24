// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin-4.5.0/contracts/access/Ownable.sol";
import "./ProxyForQstPool.sol";

contract ProxyForQstPoolFactory is Ownable {
    struct Parameters {
        address VEQst;
        address user;
    }

    Parameters public parameters;

    address public VEQst;

    bool public initialization;

    event NewProxy(address indexed proxy, address indexed user);

    modifier onlyVEQst() {
        require(msg.sender == VEQst, "Not VEQst");
        _;
    }

    /// @notice Constructor
    constructor() {}

    /// @notice Initialize
    /// @param _VEQst: VEQst contract
    function initialize(address _VEQst) external onlyOwner {
        require(!initialization, "Already initialized");
        initialization = true;
        VEQst = _VEQst;
    }

    /// @notice Deploy proxy for qst pool
    /// @param _user: Qst pool user
    /// @return proxy The proxy address
    function deploy(address _user) external onlyVEQst returns (address proxy) {
        parameters = Parameters({VEQst: VEQst, user: _user});

        proxy = address(new ProxyForQstPool{salt: keccak256(abi.encode(VEQst, _user, block.timestamp))}());

        delete parameters;

        emit NewProxy(proxy, _user);
    }
}
