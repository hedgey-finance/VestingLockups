// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.24;

import '../libraries/TransferHelper.sol';
import '../interfaces/IVestingLockup.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import '@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol';

/// @title BatchCreator is a contract that allows creating multiple vesting plans, lockup plans and vesting lockup plans in a single transaction
/// @notice there are two types of batching functions, one that creates the plans and one that creates the plans and initially delegates the tokens held by the plans
contract BatchCreator is ERC721Holder {
  /**** EVENTS FOR EACH SPECIFIC BATCH FUNCTION*****************************/

  mapping(address => bool) public whitelist;
  address private _manager;
  constructor() {
    _manager = msg.sender;
  }

  function initWhiteList(address[] memory _whiteList) external {
    require(msg.sender == _manager, 'not manager');
    for (uint256 i; i < _whiteList.length; i++) {
      whitelist[_whiteList[i]] = true;
    }
    delete _manager;
  }


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

  /// @notice struct to hold the parameters for a vesting or lockup plan, these generally define a vesting or lockup schedule
  /// @param amount is the amount of tokens in a single plan
  /// @param start is the block time start date of the plan
  /// @param cliff is an optional cliff date for the plan
  /// @param rate is the rate at which the tokens are released per period
  /// @param period is the length of time between releases, ie each period is the number of seconds in each discrete period when tokens are released
  struct Plan {
    uint256 amount;
    uint256 start;
    uint256 cliff;
    uint256 rate;
    uint256 period;
  }

  /// @notice an additional multi token transfer funtion for ERC20 tokens to make it simple to send tokens to recipients in a big batch if needed
  function multiTransferTokens(address token, address[] calldata recipients, uint256[] calldata amounts) external {
    require(recipients.length == amounts.length);
    for (uint16 i; i < recipients.length; i++) {
      TransferHelper.transferTokens(token, msg.sender, recipients[i], amounts[i]);
    }
  }

  /// @notice function to batch create lockup plans
  /// @param lockupContract is the contract address of the specific hedgey lockup plan contract
  /// @param token is the address of the token being locked up
  /// @param totalAmount is the total amount of tokens being locked up aggregated across all plans
  /// @param recipients is an array of addresses that will receive the lockup plans
  /// @param plans is an array of Plan structs that define the lockup schedules for each plan
  /// @param mintType is an optional parameter to specify the type of minting that is being done, primarily used for internal database tagging
  function createLockupPlans(
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
    require(whitelist[lockupContract], 'not whitelisted');
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

  /// @notice function to batch create lockup plans, and immeditatley have the plans delegate the tokens - should only be used for onchain voting
  /// @param lockupContract is the contract address of the specific hedgey lockup plan contract
  /// @param token is the address of the token being locked up
  /// @param totalAmount is the total amount of tokens being locked up aggregated across all plans
  /// @param recipients is an array of addresses that will receive the lockup plans
  /// @param delegatees is the array of address where each individual plan will delegate their tokens to, this may be the same as the recipients
  /// @param plans is an array of Plan structs that define the lockup schedules for each plan
  /// @param mintType is an optional parameter to specify the type of minting that is being done, primarily used for internal database tagging
  function createLockupPlansWithDelegation(
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
    require(whitelist[lockupContract], 'not whitelisted');
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

  /// @notice function to batch create vesting plans
  /// @param vestingContract is the contract address of the specific hedgey vesting plan contract
  /// @param token is the address of the token being vested
  /// @param totalAmount is the total amount of tokens being vested aggregated across all plans
  /// @param recipients is an array of addresses that will receive the vesting plans
  /// @param plans is an array of Plan structs that define the vesting schedules for each plan
  /// @param vestingAdmin is the address of the admin for the vesting plans
  /// @param adminTransferOBO is a boolean that specifies if the admin can transfer the vesting plans on behalf of the recipient
  /// @param mintType is an optional parameter to specify the type of minting that is being done, primarily used for internal database tagging
  function createVestingPlans(
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
    require(whitelist[vestingContract], 'not whitelisted');
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

  /// @notice function to batch create vesting plans with immediate delegation of the tokens. 
  /// @dev Note the vesting admin transferBOB must be true, so it is not an option
  /// @param vestingContract is the contract address of the specific hedgey vesting plan contract
  /// @param token is the address of the token being vested
  /// @param totalAmount is the total amount of tokens being vested aggregated across all plans
  /// @param recipients is an array of addresses that will receive the vesting plans
  /// @param delegatees is the array of address where each individual plan will delegate their tokens to, this may be the same as the recipients
  /// @param plans is an array of Plan structs that define the vesting schedules for each plan
  /// @param vestingAdmin is the address of the admin for the vesting plans
  /// @param mintType is an optional parameter to specify the type of minting that is being done, primarily used for internal database tagging
  function createVestingPlansWithDelegation(
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
    require(whitelist[vestingContract], 'not whitelisted');
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

  /// @notice function to batch create vesting lockup plans
  /// @param lockupContract is the contract address of the specific hedgey lockup plan contract
  /// @param token is the address of the token being vested
  /// @param totalAmount is the total amount of tokens being vested aggregated across all plans
  /// @param recipients is an array of Recipient structs that define the beneficiary and adminRedeem status for each plan
  /// @param vestingPlans is an array of Plan structs that define the vesting schedules for each plan
  /// @param vestingAdmin is the address of the admin for the vesting plans
  /// @param adminTransferOBO is a boolean that specifies if the admin can transfer the vesting plans on behalf of the recipient
  /// @param locks is an array of Plan structs that define the lockup schedules for each veting plan
  /// @param transferablelocks is a boolean that specifies if the lockup plans can be transferred by the beneficiary
  /// @param mintType is an optional parameter to specify the type of minting that is being done, primarily used for internal database tagging
  function createVestingLockupPlans(
    address lockupContract,
    address token,
    uint256 totalAmount,
    IVestingLockup.Recipient[] calldata recipients,
    Plan[] calldata vestingPlans,
    address vestingAdmin,
    bool adminTransferOBO,
    Plan[] calldata locks,
    bool transferablelocks,
    uint8 mintType
  ) external returns (uint256[] memory, uint256[] memory) {
    require(vestingPlans.length == recipients.length, 'lenError');
    require(vestingPlans.length == locks.length, 'lenError');
    require(totalAmount > 0, '0_totalAmount');
    require(whitelist[lockupContract], 'not whitelisted');
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
        false
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

  /// @notice function to batch create vesting lockup plans with immediate delegation. 
  /// @dev Note that only the Vesting Plans will delegate initially, not the locksup
  /// @param lockupContract is the contract address of the specific hedgey lockup plan contract
  /// @param token is the address of the token being vested
  /// @param totalAmount is the total amount of tokens being vested aggregated across all plans
  /// @param recipients is an array of Recipient structs that define the beneficiary and adminRedeem status for each plan
  /// @param delegatees is an array of addresses that will receive the vesting plans
  /// @param vestingPlans is an array of Plan structs that define the vesting schedules for each plan
  /// @param vestingAdmin is the address of the admin for the vesting plans
  /// @param adminTransferOBO is a boolean that specifies if the admin can transfer the vesting plans on behalf of the recipient
  /// @param locks is an array of Plan structs that define the lockup schedules for each veting plan
  /// @param transferablelocks is a boolean that specifies if the lockup plans can be transferred by the beneficiary
  /// @param mintType is an optional parameter to specify the type of minting that is being done, primarily used for internal database tagging
  function createVestingLockupPlansWithDelegation(
    address lockupContract,
    address token,
    uint256 totalAmount,
    IVestingLockup.Recipient[] calldata recipients,
    address[] calldata delegatees,
    Plan[] calldata vestingPlans,
    address vestingAdmin,
    bool adminTransferOBO,
    Plan[] calldata locks,
    bool transferablelocks,
    uint8 mintType
  ) external returns (uint256[] memory, uint256[] memory) {
    require(vestingPlans.length == recipients.length, 'lenError');
    require(vestingPlans.length == locks.length, 'lenError');
    require(totalAmount > 0, '0_totalAmount');
    require(whitelist[lockupContract], 'not whitelisted');
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
