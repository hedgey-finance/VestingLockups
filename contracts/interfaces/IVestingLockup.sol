// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.24;

interface IVestingLockup {
  struct Recipient {
    address beneficiary;
    bool adminRedeem;
  }

  function createPlan(
    address recipient,
    address token,
    uint256 amount,
    uint256 start,
    uint256 cliff,
    uint256 rate,
    uint256 period,
    address vestingAdmin,
    bool adminTransferOBO
  ) external returns (uint256);

  function createPlan(
    address recipient,
    address token,
    uint256 amount,
    uint256 start,
    uint256 cliff,
    uint256 rate,
    uint256 period
  ) external returns (uint256);

  function createVestingLock(
    Recipient memory recipient,
    uint256 vestingTokenId,
    uint256 start,
    uint256 cliff,
    uint256 rate,
    uint256 period,
    bool transferable,
    bool adminTransferOBO
  ) external returns (uint256 newLockId);

  function hedgeyVesting() external view returns (address);

  function delegate(uint256 planId, address delegatee) external;

  function changeVestingPlanAdmin(uint256 planId, address newAdmin) external;
}
