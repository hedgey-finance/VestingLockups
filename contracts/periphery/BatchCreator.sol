// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.24;

import '../libraries/TransferHelper.sol';
import '../interfaces/ICreate.sol';

import 'hardhat/console.sol';

contract BatchCreator {
  event BatchCreated(address indexed sender, address indexed token, uint256 numPlansCreated, uint256[] vestingPlandIds, uint256[] lockIds,  uint256 totalAmount, uint8 mintType);

  struct Plan {
    uint256 amount;
    uint256 start;
    uint256 cliff;
    uint256 rate;
  }

  function createVestingLockupPlans(
    address vestingContract,
    address lockupContract,
    address token,
    uint256 period,
    address vestingAdmin,
    bool adminTransferOBO,
    Plan[] calldata vestingPlans,
    ICreate.Recipient[] calldata recipients,
    Plan[] calldata locks,
    bool transferablelocks,
    uint256 totalAmount,
    uint8 mintType
  ) external returns (uint256[] memory, uint256[] memory) {
    require(vestingPlans.length == recipients.length, 'lenError');
    require(vestingPlans.length == locks.length, 'lenError');
    require(totalAmount > 0, '0_totalAmount');
    require(ICreate(lockupContract).hedgeyVesting() == vestingContract, 'wrongContracts');
    TransferHelper.transferTokens(token, msg.sender, address(this), totalAmount);
    SafeERC20.safeIncreaseAllowance(IERC20(token), vestingContract, totalAmount);
    uint256 amountCheck;
    uint256[] memory newVestingIds = new uint256[](vestingPlans.length);
    uint256[] memory newLockIds = new uint256[](vestingPlans.length);
    for (uint16 i; i < vestingPlans.length; i++) {
      uint256 newVestingId = ICreate(vestingContract).createPlan(
        lockupContract,
        token,
        vestingPlans[i].amount,
        vestingPlans[i].start,
        vestingPlans[i].cliff,  
        vestingPlans[i].rate,
        period,
        vestingAdmin,
        adminTransferOBO
      );
      uint256 newLockId = ICreate(lockupContract).createVestingLock(
        ICreate.Recipient(recipients[i].beneficiary, recipients[i].adminRedeem),
        newVestingId,
        locks[i].start,
        locks[i].cliff,
        locks[i].rate,
        transferablelocks,
        adminTransferOBO
      );
      newVestingIds[i] = newVestingId;
      newLockIds[i] = newLockId;
      amountCheck += vestingPlans[i].amount;
    }
    require(amountCheck == totalAmount, 'amount error');
    emit BatchCreated(msg.sender, token, vestingPlans.length, newVestingIds, newLockIds, totalAmount, mintType);
    return (newVestingIds, newLockIds);
  }
}
