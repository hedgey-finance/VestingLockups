// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.24;

interface IVesting {
  struct Plan {
    address token;
    uint256 amount;
    uint256 start;
    uint256 cliff;
    uint256 rate;
    uint256 period;
    address vestingAdmin;
    bool adminTransferOBO;
  }

  function plans(uint256 planId) external view returns (Plan memory);

  function redeemPlans(uint256[] calldata planIds) external;

  function delegate(uint256 planId, address delegatee) external;

  function delegatePlans(uint256[] calldata planIds, address[] calldata delegatees) external;

  function setupVoting(uint256 planId) external returns (address votingVault);

  function toggleAdminTransferOBO(uint256 planId, bool adminTransferOBO) external;

  function ownerOf(uint256 planId) external view returns (address owner);

  function planBalanceOf(
    uint256 planId,
    uint256 timeStamp,
    uint256 redemptionTime
  ) external view returns (uint256 balance, uint256 remainder, uint256 latestUnlock);
}