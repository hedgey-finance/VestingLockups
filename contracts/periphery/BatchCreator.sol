// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.24;

import '../libraries/TransferHelper.sol';
import '../interfaces/IVestingLockup.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import '@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol';

/// @title BatchCreator is a contract that allows creating multiple vesting plans, lockup plans and vesting lockup plans in a single transaction

contract BatchCreator is ERC721Holder {
  event VestingLockupBatchCreated(
    address indexed creator,
    address indexed token,
    uint256 numPlansCreated,
    uint256[] planIds,
    uint256[] lockIds,
    uint256 totalAmount,
    uint8 mintType
  );
  event VestingBatchCreated(
    address indexed creator,
    address indexed token,
    uint256 numPlansCreated,
    uint256[] planIds,
    uint256 totalAmount,
    uint8 mintType
  );
  event LockupBatchCreated(
    address indexed creator,
    address indexed token,
    uint256 numPlansCreated,
    uint256[] planIds,
    uint256 totalAmount,
    uint8 mintType
  );

  struct Plan {
    uint256 amount;
    uint256 start;
    uint256 cliff;
    uint256 rate;
    uint256 period;
  }

  function batchLockingPlans(
    address lockupContract,
    address token,
    uint256 totalAmount,
    address[] calldata recipients,
    Plan[] calldata plans,
    uint8 mintType
  ) external returns (uint256[] memory) {
    require(totalAmount > 0, '0_totalAmount');
    require(lockupContract != address(0), '0_locker');
    require(token != address(0), '0_token');
    require(plans.length > 0, 'no plans');
    TransferHelper.transferTokens(token, msg.sender, address(this), totalAmount);
    SafeERC20.safeIncreaseAllowance(IERC20(token), lockupContract, totalAmount);
    uint256 amountCheck;
    uint256[] memory newPlanIds = new uint256[](recipients.length);
    for (uint16 i; i < plans.length; i++) {
      uint256 newPlanId = IVestingLockup(lockupContract).createPlan(
        recipients[i],
        token,
        plans[i].amount,
        plans[i].start,
        plans[i].cliff,
        plans[i].rate,
        plans[i].period
      );
      amountCheck += plans[i].amount;
      newPlanIds[i] = newPlanId;
    }
    require(amountCheck == totalAmount, 'totalAmount error');
    emit LockupBatchCreated(msg.sender, token, plans.length, newPlanIds, totalAmount, mintType);
    return newPlanIds;
  }

  function batchLockingPlansWithDelegation(
    address lockupContract,
    address token,
    uint256 totalAmount,
    address[] calldata recipients,
    address[] calldata delegatees,
    Plan[] calldata plans,
    uint8 mintType
  ) external returns (uint256[] memory) {
    require(totalAmount > 0, '0_totalAmount');
    require(lockupContract != address(0), '0_locker');
    require(token != address(0), '0_token');
    require(plans.length > 0, 'no plans');
    TransferHelper.transferTokens(token, msg.sender, address(this), totalAmount);
    SafeERC20.safeIncreaseAllowance(IERC20(token), lockupContract, totalAmount);
    uint256 amountCheck;
    uint256[] memory newPlanIds = new uint256[](recipients.length);
    for (uint16 i; i < plans.length; i++) {
      uint256 newPlanId = IVestingLockup(lockupContract).createPlan(
        address(this),
        token,
        plans[i].amount,
        plans[i].start,
        plans[i].cliff,
        plans[i].rate,
        plans[i].period
      );
      amountCheck += plans[i].amount;
      newPlanIds[i] = newPlanId;
      IVestingLockup(lockupContract).delegate(newPlanId, delegatees[i]);
      IERC721(lockupContract).transferFrom(address(this), recipients[i], newPlanId);
    }
    require(amountCheck == totalAmount, 'totalAmount error');
    emit LockupBatchCreated(msg.sender, token, plans.length, newPlanIds, totalAmount, mintType);
    return newPlanIds;
  }

  function batchVestingPlans(
    address vestingContract,
    address token,
    uint256 totalAmount,
    address[] calldata recipients,
    Plan[] calldata plans,
    address vestingAdmin,
    bool adminTransferOBO,
    uint8 mintType
  ) external returns (uint256[] memory) {
    require(totalAmount > 0, '0_totalAmount');
    require(vestingContract != address(0), '0_vesting');
    require(token != address(0), '0_token');
    require(plans.length > 0, 'no plans');
    TransferHelper.transferTokens(token, msg.sender, address(this), totalAmount);
    SafeERC20.safeIncreaseAllowance(IERC20(token), vestingContract, totalAmount);
    uint256 amountCheck;
    uint256[] memory newPlanIds = new uint256[](recipients.length);
    for (uint16 i; i < plans.length; i++) {
      uint256 newPlanId = IVestingLockup(vestingContract).createPlan(
        recipients[i],
        token,
        plans[i].amount,
        plans[i].start,
        plans[i].cliff,
        plans[i].rate,
        plans[i].period,
        vestingAdmin,
        adminTransferOBO
      );
      amountCheck += plans[i].amount;
      newPlanIds[i] = newPlanId;
    }
    require(amountCheck == totalAmount, 'totalAmount error');
    emit VestingBatchCreated(msg.sender, token, plans.length, newPlanIds, totalAmount, mintType);
    return newPlanIds;
  }

  function batchVestingPlansWithDelegation(
    address vestingContract,
    address token,
    uint256 totalAmount,
    address[] calldata recipients,
    address[] calldata delegatees,
    Plan[] calldata plans,
    address vestingAdmin,
    uint8 mintType
  ) external returns (uint256[] memory) {
    require(totalAmount > 0, '0_totalAmount');
    require(vestingContract != address(0), '0_vesting');
    require(token != address(0), '0_token');
    require(plans.length > 0, 'no plans');
    TransferHelper.transferTokens(token, msg.sender, address(this), totalAmount);
    SafeERC20.safeIncreaseAllowance(IERC20(token), vestingContract, totalAmount);
    uint256 amountCheck;
    uint256[] memory newPlanIds = new uint256[](recipients.length);
    for (uint16 i; i < plans.length; i++) {
      uint256 newPlanId = IVestingLockup(vestingContract).createPlan(
        address(this),
        token,
        plans[i].amount,
        plans[i].start,
        plans[i].cliff,
        plans[i].rate,
        plans[i].period,
        address(this),
        true
      );
      amountCheck += plans[i].amount;
      newPlanIds[i] = newPlanId;
      IVestingLockup(vestingContract).delegate(newPlanId, delegatees[i]);
      IERC721(vestingContract).transferFrom(address(this), recipients[i], newPlanId);
      IVestingLockup(vestingContract).changeVestingPlanAdmin(newPlanId, vestingAdmin);
    }
    require(amountCheck == totalAmount, 'totalAmount error');
    emit VestingBatchCreated(msg.sender, token, plans.length, newPlanIds, totalAmount, mintType);
    return newPlanIds;
  }

  function createVestingLockupPlans(
    address lockupContract,
    address token,
    IVestingLockup.Recipient[] calldata recipients,
    Plan[] calldata vestingPlans,
    address vestingAdmin,
    bool adminTransferOBO,
    Plan[] calldata locks,
    bool transferablelocks,
    uint256 totalAmount,
    uint8 mintType
  ) external returns (uint256[] memory, uint256[] memory) {
    require(vestingPlans.length == recipients.length, 'lenError');
    require(vestingPlans.length == locks.length, 'lenError');
    require(totalAmount > 0, '0_totalAmount');
    address vestingContract = IVestingLockup(lockupContract).hedgeyVesting();
    TransferHelper.transferTokens(token, msg.sender, address(this), totalAmount);
    SafeERC20.safeIncreaseAllowance(IERC20(token), vestingContract, totalAmount);
    uint256 amountCheck;
    uint256[] memory newVestingIds = new uint256[](vestingPlans.length);
    uint256[] memory newLockIds = new uint256[](vestingPlans.length);
    for (uint16 i; i < vestingPlans.length; i++) {
      uint256 newVestingId = IVestingLockup(vestingContract).createPlan(
        lockupContract,
        token,
        vestingPlans[i].amount,
        vestingPlans[i].start,
        vestingPlans[i].cliff,
        vestingPlans[i].rate,
        vestingPlans[i].period,
        vestingAdmin,
        true
      );
      uint256 newLockId = IVestingLockup(lockupContract).createVestingLock(
        IVestingLockup.Recipient(recipients[i].beneficiary, recipients[i].adminRedeem),
        newVestingId,
        locks[i].start,
        locks[i].cliff,
        locks[i].rate,
        locks[i].period,
        transferablelocks,
        adminTransferOBO
      );
      newVestingIds[i] = newVestingId;
      newLockIds[i] = newLockId;
      amountCheck += vestingPlans[i].amount;
    }
    require(amountCheck == totalAmount, 'totalAmount error');
    emit VestingLockupBatchCreated(
      msg.sender,
      token,
      vestingPlans.length,
      newVestingIds,
      newLockIds,
      totalAmount,
      mintType
    );
    return (newVestingIds, newLockIds);
  }

  function createVestingLockupPlansWithDelegation(
    address lockupContract,
    address token,
    IVestingLockup.Recipient[] calldata recipients,
    address[] calldata delegatees,
    Plan[] calldata vestingPlans,
    address vestingAdmin,
    bool adminTransferOBO,
    Plan[] calldata locks,
    bool transferablelocks,
    uint256 totalAmount,
    uint8 mintType
  ) external returns (uint256[] memory, uint256[] memory) {
    require(vestingPlans.length == recipients.length, 'lenError');
    require(vestingPlans.length == locks.length, 'lenError');
    require(totalAmount > 0, '0_totalAmount');
    address vestingContract = IVestingLockup(lockupContract).hedgeyVesting();
    TransferHelper.transferTokens(token, msg.sender, address(this), totalAmount);
    SafeERC20.safeIncreaseAllowance(IERC20(token), vestingContract, totalAmount);
    uint256 amountCheck;
    uint256[] memory newVestingIds = new uint256[](vestingPlans.length);
    uint256[] memory newLockIds = new uint256[](vestingPlans.length);
    for (uint16 i; i < vestingPlans.length; i++) {
      uint256 newVestingId = IVestingLockup(vestingContract).createPlan(
        address(this),
        token,
        vestingPlans[i].amount,
        vestingPlans[i].start,
        vestingPlans[i].cliff,
        vestingPlans[i].rate,
        vestingPlans[i].period,
        address(this),
        true
      );
      IVestingLockup(vestingContract).delegate(newVestingId, delegatees[i]);
      IERC721(vestingContract).transferFrom(address(this), lockupContract, newVestingId);
      IVestingLockup(vestingContract).changeVestingPlanAdmin(newVestingId, vestingAdmin);
      uint256 newLockId = IVestingLockup(lockupContract).createVestingLock(
        IVestingLockup.Recipient(recipients[i].beneficiary, recipients[i].adminRedeem),
        newVestingId,
        locks[i].start,
        locks[i].cliff,
        locks[i].rate,
        locks[i].period,
        transferablelocks,
        adminTransferOBO
      );
      newVestingIds[i] = newVestingId;
      newLockIds[i] = newLockId;
      amountCheck += vestingPlans[i].amount;
    }
    require(amountCheck == totalAmount, 'totalAmount error');
    emit VestingLockupBatchCreated(
      msg.sender,
      token,
      vestingPlans.length,
      newVestingIds,
      newLockIds,
      totalAmount,
      mintType
    );
    return (newVestingIds, newLockIds);
  }
}
