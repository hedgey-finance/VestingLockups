// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.24;

import '../libraries/TransferHelper.sol';
import '../interfaces/ICreate.sol';

contract BatchCreator {
  event BatchCreated(address indexed sender, address indexed token, uint256 count, uint256 totalAmount, uint8 mintType);

  struct Plan {
    uint256 amount;
    uint256 start;
    uint256 cliff;
    uint256 rate;
    uint256 period;
    address vestingAdmin;
    bool adminTransferOBO;
  }

  function createVestingLockupPlans(
    address vestingContract,
    address lockupContract,
    address token,
    Plan[] calldata vestingPlans,
    ICreate.Recipient[] calldata recipients,
    Plan[] calldata locks,
    bool[] calldata transferablelocks,
    uint256 totalAmount,
    uint8 mintType
  ) external {
    require(vestingPlans.length == recipients.length, 'lenError');
    require(vestingPlans.length == locks.length, 'lenError');
    require(totalAmount > 0, '0_totalAmount');
    require(ICreate(lockupContract).hedgeyVesting() == vestingContract, 'wrongContracts');
    TransferHelper.transferTokens(token, msg.sender, address(this), totalAmount);
    SafeERC20.safeIncreaseAllowance(IERC20(token), vestingContract, totalAmount);
    uint256 amountCheck;
    for (uint16 i; i < vestingPlans.length; i++) {
      uint256 newTokenId = ICreate(vestingContract).createPlan(
        lockupContract,
        token,
        vestingPlans[i].amount,
        vestingPlans[i].start,
        vestingPlans[i].cliff,
        vestingPlans[i].rate,
        vestingPlans[i].period,
        vestingPlans[i].vestingAdmin,
        vestingPlans[i].adminTransferOBO
      );
      ICreate(lockupContract).createVestingLock(
        ICreate.Recipient(recipients[i].beneficiary, recipients[i].adminRedeem),
        newTokenId,
        locks[i].start,
        locks[i].cliff,
        locks[i].rate,
        locks[i].period,
        transferablelocks[i],
        locks[i].adminTransferOBO
      );
      amountCheck += vestingPlans[i].amount;
    }
    require(amountCheck == totalAmount, 'amount error');
    emit BatchCreated(msg.sender, token, vestingPlans.length, totalAmount, mintType);
  }
}
