// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.24;

import '../libraries/TransferHelper.sol';

interface IGovernanceToken {
  function delegate(address delegatee) external;
  function delegates(address wallet) external view returns (address delegate);
}

contract VotingVault {
  address public token;
  address public controller;

  constructor(address _token, address beneficiary) {
    controller = msg.sender;
    token = _token;
    address existingDelegate = IGovernanceToken(token).delegates(beneficiary);
    if (existingDelegate != address(0)) IGovernanceToken(token).delegate(existingDelegate);
    else IGovernanceToken(token).delegate(beneficiary);
  }

  modifier onlyController() {
    require(msg.sender == controller);
    _;
  }

    /// @notice function to delegate the tokens of this address
    /// @dev if the delegatee is the existing delegate, skip the delegate function call - would be redundant
  function delegateTokens(address delegatee) external onlyController {
    address existingDelegate = IGovernanceToken(token).delegates(address(this));
    if (existingDelegate != delegatee) {
      uint256 balanceCheck = IERC20(token).balanceOf(address(this));
      IGovernanceToken(token).delegate(delegatee);
      // check to make sure delegate function is not malicious
      require(balanceCheck == IERC20(token).balanceOf(address(this)));
    }
  }

  function withdrawTokens(address to, uint256 amount) external onlyController {
    TransferHelper.withdrawTokens(token, to, amount);
  }
}
