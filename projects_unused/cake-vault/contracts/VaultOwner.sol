// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./QstVault.sol";

contract VaultOwner is Ownable {
    using SafeERC20 for IERC20;

    QstVault public immutable qstVault;

    /**
     * @notice Constructor
     * @param _qstVaultAddress: QstVault contract address
     */
    constructor(address _qstVaultAddress) public {
        qstVault = QstVault(_qstVaultAddress);
    }

    /**
     * @notice Sets admin address to this address
     * @dev Only callable by the contract owner.
     * It makes the admin == owner.
     */
    function setAdmin() external onlyOwner {
        qstVault.setAdmin(address(this));
    }

    /**
     * @notice Sets treasury address
     * @dev Only callable by the contract owner.
     */
    function setTreasury(address _treasury) external onlyOwner {
        qstVault.setTreasury(_treasury);
    }

    /**
     * @notice Sets performance fee
     * @dev Only callable by the contract owner.
     */
    function setPerformanceFee(uint256 _performanceFee) external onlyOwner {
        qstVault.setPerformanceFee(_performanceFee);
    }

    /**
     * @notice Sets call fee
     * @dev Only callable by the contract owner.
     */
    function setCallFee(uint256 _callFee) external onlyOwner {
        qstVault.setCallFee(_callFee);
    }

    /**
     * @notice Sets withdraw fee
     * @dev Only callable by the contract owner.
     */
    function setWithdrawFee(uint256 _withdrawFee) external onlyOwner {
        qstVault.setWithdrawFee(_withdrawFee);
    }

    /**
     * @notice Sets withdraw fee period
     * @dev Only callable by the contract owner.
     */
    function setWithdrawFeePeriod(uint256 _withdrawFeePeriod) external onlyOwner {
        qstVault.setWithdrawFeePeriod(_withdrawFeePeriod);
    }

    /**
     * @notice Withdraw unexpected tokens sent to the Qst Vault
     */
    function inCaseTokensGetStuck(address _token) external onlyOwner {
        qstVault.inCaseTokensGetStuck(_token);
        uint256 amount = IERC20(_token).balanceOf(address(this));
        IERC20(_token).safeTransfer(msg.sender, amount);
    }

    /**
     * @notice Triggers stopped state
     * @dev Only possible when contract not paused.
     */
    function pause() external onlyOwner {
        qstVault.pause();
    }

    /**
     * @notice Returns to normal state
     * @dev Only possible when contract is paused.
     */
    function unpause() external onlyOwner {
        qstVault.unpause();
    }
}
