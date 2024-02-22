// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.24;

import '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import './ERC721Delegate/PlanDelegator.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol';

import './libraries/UnlockLibrary.sol';
import './libraries/TransferHelper.sol';
import './interfaces/IVesting.sol';

import './VotingVault.sol';

contract VotingTokenVestingLock is PlanDelegator, ReentrancyGuard, ERC721Holder {
  IVesting public hedgeyVesting;

  address public hedgeyPlanCreator;

  string public baseURI;
  /// @dev bool to ensure uri has been set before admin can be deleted
  bool internal uriSet;
  /// @dev admin for setting the baseURI;
  address internal uriAdmin;

  uint256 internal _tokenIds;

  struct Recipient {
    address beneficiary;
    bool adminRedeem;
  }

  struct VestingLock {
    address token;
    uint256 totalAmount;
    uint256 availableAmount;
    uint256 start;
    uint256 cliff;
    uint256 rate;
    uint256 period;
    uint256 vestingTokenId;
    address vestingAdmin;
    bool transferable;
    bool adminTransferOBO;
  }

  /// mapping from NFT Token Issued to Lock
  mapping(uint256 => VestingLock) internal _vestingLocks;

  mapping(uint256 => bool) internal _allocatedVestingTokenIds;

  mapping(uint256 => mapping(address => bool)) internal _approvedRedeemers;

  mapping(uint256 => bool) internal _adminRedeem;

  mapping(uint256 => address) public votingVaults;

  event RedeemerApproved(uint256 indexed lockId, address redeemer);
  event RedeemerRemoved(uint256 indexed lockId, address redeemer);
  event AdminRedemption(uint256 indexed lockId, bool enabled);
  event VotingVaultCreated(uint256 indexed lockId, address votingVault);

  constructor(
    string memory name,
    string memory symbol,
    address _hedgeyVesting,
    address _hedgeyPlanCreator
  ) ERC721(name, symbol) {
    hedgeyVesting = IVesting(_hedgeyVesting);
    hedgeyPlanCreator = _hedgeyPlanCreator;
    uriAdmin = msg.sender;
  }

  /*****TOKEN ID FUNCTIONS************************************************************************************ */

  function incrementTokenId() internal returns (uint256) {
    _tokenIds++;
    return _tokenIds;
  }

  function currentTokenId() public view returns (uint256) {
    return _tokenIds;
  }

  function getVestingLock(uint256 lockId) public view returns (VestingLock memory) {
    return _vestingLocks[lockId];
  }

  /***********************REDEEMER FUNCTIONS**********************************************************************/

  function approveRedeemer(uint256 lockId, address redeemer) external {
    require(msg.sender == ownerOf(lockId), '!owner');
    _approvedRedeemers[lockId][redeemer] = true;
    emit RedeemerApproved(lockId, redeemer);
  }

  function removeRedeemer(uint256 lockId, address redeemer) external {
    require(msg.sender == ownerOf(lockId), '!owner');
    delete _approvedRedeemers[lockId][redeemer];
    emit RedeemerRemoved(lockId, redeemer);
  }

  function setAdminRedemption(uint256 lockId, bool enabled) external {
    require(msg.sender == ownerOf(lockId), '!owner');
    _adminRedeem[lockId] = enabled;
    emit AdminRedemption(lockId, enabled);
  }

  function isApprovedRedeemer(uint256 lockId, address redeemer) public view returns (bool) {
    address owner = ownerOf(lockId);
    return (owner == redeemer || _approvedRedeemers[lockId][redeemer] || _adminRedeem[lockId]);
  }

  /******CORE FUNCTIONS *********************************************************************************************/

  function createVestingLock(
    Recipient memory recipient,
    uint256 vestingTokenId,
    uint256 start,
    uint256 cliff,
    uint256 rate,
    uint256 period,
    bool transferable,
    bool adminTransferOBO
  ) external nonReentrant returns (uint256 newLockId) {
    // some require stataments
    require(msg.sender == hedgeyPlanCreator);
    require(_allocatedVestingTokenIds[vestingTokenId] == false, 'allocated');
    require(hedgeyVesting.ownerOf(vestingTokenId) == address(this), '!ownerOfNFT');
    _allocatedVestingTokenIds[vestingTokenId] == true;
    address vestingAdmin = hedgeyVesting.plans(vestingTokenId).vestingAdmin;
    newLockId = incrementTokenId();
    uint256 totalAmount = hedgeyVesting.plans(vestingTokenId).amount;
    address token = hedgeyVesting.plans(vestingTokenId).token;
    _vestingLocks[newLockId] = VestingLock(
      token,
      totalAmount,
      0,
      start,
      cliff,
      rate,
      period,
      vestingTokenId,
      vestingAdmin,
      transferable,
      adminTransferOBO
    );
    if (recipient.adminRedeem) {
      _adminRedeem[newLockId] = true;
      emit AdminRedemption(newLockId, true);
    }
    _mint(recipient.beneficiary, newLockId);
  }

  function redeemAndUnlockPlans(uint256[] calldata lockIds) external nonReentrant {
    for (uint256 i = 0; i < lockIds.length; i++) {
      _redeemVesting(lockIds[i]);
      _unlock(lockIds[i]);
    }
  }

  function unlockPlans(uint256[] calldata lockIds) external nonReentrant {
    for (uint256 i = 0; i < lockIds.length; i++) {
      _unlock(lockIds[i]);
    }
  }

  function redeemVestingPlans(uint256[] calldata lockIds) external nonReentrant {
    for (uint256 i = 0; i < lockIds.length; i++) {
      _redeemVesting(lockIds[i]);
    }
  }

  function updateAdminTransferOBO(uint256 lockId, bool adminTransferOBO) external {
    require(msg.sender == ownerOf(lockId), '!owner');
    _vestingLocks[lockId].adminTransferOBO = adminTransferOBO;
  }

  function burnRevokedVesting(uint256 lockId) external {
    require(isApprovedRedeemer(lockId, msg.sender), '!approved');
    VestingLock memory lock = _vestingLocks[lockId];
    require(lock.availableAmount == 0, 'available_amount');
    try hedgeyVesting.ownerOf(lock.vestingTokenId) {
      revert('vesting not revoked');
    } catch {
      _burn(lockId);
      delete _vestingLocks[lockId];
      delete _allocatedVestingTokenIds[lock.vestingTokenId];
    }
  }

  function _unlock(uint256 lockid) internal {
    require(isApprovedRedeemer(lockid, msg.sender), '!approved');
    VestingLock memory lock = _vestingLocks[lockid];
    require(_allocatedVestingTokenIds[lock.vestingTokenId], 'not allocated');
    (uint256 unlockedBalance, uint256 lockedBalance, uint256 unlockTime) = UnlockLibrary.balanceAtTime(
      lock.start,
      lock.cliff,
      lock.availableAmount,
      lock.rate,
      lock.period,
      block.timestamp,
      block.timestamp
    );
    require(unlockedBalance > 0, 'no_unlocked_balance');
    // transfer balance out
    if (votingVaults[lockid] != address(0)) {
      VotingVault(votingVaults[lockid]).withdrawTokens(ownerOf(lockid), unlockedBalance);
    } else {
      TransferHelper.withdrawTokens(lock.token, ownerOf(lockid), unlockedBalance);
    }
    uint256 remainingTotal = lock.totalAmount - unlockedBalance;
    if (remainingTotal == 0) {
      // need to check that the vesting token has been burned as well
      _burn(lockid);
      delete _vestingLocks[lockid];
      delete _allocatedVestingTokenIds[lock.vestingTokenId];
    } else {
      _vestingLocks[lockid].availableAmount = lockedBalance;
      _vestingLocks[lockid].start = unlockTime;
      _vestingLocks[lockid].totalAmount = remainingTotal;
    }
  }

  function _redeemVesting(uint256 lockId) internal {
    require(isApprovedRedeemer(lockId, msg.sender), '!approved');
    uint256 vestingId = _vestingLocks[lockId].vestingTokenId;
    require(_allocatedVestingTokenIds[vestingId], 'not allocated');
    require(hedgeyVesting.ownerOf(vestingId) == address(this), '!ownerOfNFT');
    (uint256 balance, , ) = hedgeyVesting.planBalanceOf(vestingId, block.timestamp, block.timestamp);
    require(balance > 0, 'nothing to redeem');
    uint256 preRedemptionBalance = IERC20(_vestingLocks[lockId].token).balanceOf(address(this));
    uint256[] memory vestingIds = new uint256[](1);
    vestingIds[0] = vestingId;
    hedgeyVesting.redeemPlans(vestingIds);
    uint256 postRedemptionBalance = IERC20(_vestingLocks[lockId].token).balanceOf(address(this));
    require(postRedemptionBalance - preRedemptionBalance == balance, 'redeem error');
    // tokens are pulled into this contract, update the available amount to increase based on the new balanced pulled in
    _vestingLocks[lockId].availableAmount += balance;
    require(_vestingLocks[lockId].availableAmount <= _vestingLocks[lockId].totalAmount, 'available > total');
    // if they have setup on chain voting send the tokens to the voting vault
    if (votingVaults[lockId] != address(0)) {
      TransferHelper.withdrawTokens(_vestingLocks[lockId].token, votingVaults[lockId], balance);
    }
  }

  /************************************VESTING ADMIN FUNCTIONS**********************************************************/

  function updateVestingAdmin(uint256 lockId, address newAdmin) external {
    address vestingAdmin = hedgeyVesting.plans(_vestingLocks[lockId].vestingTokenId).vestingAdmin;
    require(msg.sender == _vestingLocks[lockId].vestingAdmin || msg.sender == vestingAdmin, '!vestingAdmin');
    _vestingLocks[lockId].vestingAdmin = newAdmin;
  }

  function updateTransferability(uint256 lockId, bool transferable) external {
    require(msg.sender == _vestingLocks[lockId].vestingAdmin, '!vestingAdmin');
    _vestingLocks[lockId].transferable = transferable;
  }

  /***************DELEGATION FUNCTIONS**********************************************************************************/

  function delegateVestingPlan(uint256 lockId, address delegatee) external {
    require(_isApprovedDelegatorOrOwner(msg.sender, lockId), '!approved');
    hedgeyVesting.delegate(_vestingLocks[lockId].vestingTokenId, delegatee);
  }

  function delegateVestingPlans(uint256[] calldata lockIds, address[] calldata delegatees) external nonReentrant {
    require(lockIds.length == delegatees.length, 'array error');
    for (uint256 i; i < lockIds.length; i++) {
      require(_isApprovedDelegatorOrOwner(msg.sender, lockIds[i]), '!approved');
    }
    hedgeyVesting.delegatePlans(lockIds, delegatees);
  }

  /// @notice function to setup a voting vault, this calls an internal voting function to set it up
  /// @param lockId is the id of the vesting plan and NFT
  function setupVoting(uint256 lockId) external nonReentrant returns (address votingVault) {
    votingVault = _setupVoting(lockId);
  }

  /// @notice function for an owner of a vesting plan to delegate a single vesting plan to  single delegate
  /// @dev this will call an internal delegate function for processing
  /// if there is no voting vault setup, this function will automatically create a voting vault and then delegate the tokens to the delegatee
  /// @param lockId is the id of the vesting plan and NFT
  function delegate(uint256 lockId, address delegatee) external nonReentrant {
    _delegate(lockId, delegatee);
  }

  /// @notice this function allows an owner of multiple vesting plans to delegate multiple of them in a single transaction, each planId corresponding to a delegatee address
  /// @param lockIds is the ids of the vesting plan and NFT
  /// @param delegatees is the array of addresses where each vesting plan will delegate the tokens to
  function delegatePlans(uint256[] calldata lockIds, address[] calldata delegatees) external nonReentrant {
    require(lockIds.length == delegatees.length, 'array error');
    for (uint256 i; i < lockIds.length; i++) {
      _delegate(lockIds[i], delegatees[i]);
    }
  }

  /// @notice the internal function to setup a voting vault.
  /// @dev this will check that no voting vault exists already and then deploy a new voting vault contract
  // during the constructor setup of the voting vault, it will auto delegate the voting vault address to whatever the existing delegate of the vesting plan holder has delegated to
  // if it has not delegated yet, it will self-delegate the tokens
  /// then transfer the tokens remaining in the vesting plan to the voting vault physically
  /// @param lockId is the id of the vesting plan and NFT
  function _setupVoting(uint256 lockId) internal returns (address) {
    require(_isApprovedDelegatorOrOwner(msg.sender, lockId), '!delegator');
    require(votingVaults[lockId] == address(0), 'exists');
    VestingLock memory lock = _vestingLocks[lockId];
    VotingVault vault = new VotingVault(lock.token, ownerOf(lockId));
    votingVaults[lockId] = address(vault);
    TransferHelper.withdrawTokens(lock.token, address(vault), lock.availableAmount);
    emit VotingVaultCreated(lockId, address(vault));
    return address(vault);
  }

  /// @notice this internal function will physically delegate tokens held in a voting vault to a delegatee
  /// @dev if a voting vautl has not been setup yet, then the function will call the internal _setupVoting function and setup a new voting vault
  /// and then it will delegate the tokens held in the vault to the delegatee
  /// @param lockId is the id of the vesting plan and NFT
  /// @param delegatee is the address of the delegatee where the tokens in the voting vault will be delegated to
  function _delegate(uint256 lockId, address delegatee) internal {
    require(_isApprovedDelegatorOrOwner(msg.sender, lockId), '!delegator');
    address vault = votingVaults[lockId];
    if (votingVaults[lockId] == address(0)) {
      vault = _setupVoting(lockId);
    }
    VotingVault(vault).delegateTokens(delegatee);
  }

  /*******INTERNAL OVERRIDE TRANSFERABILITY*********************************************************************************/

  function _update(address to, uint256 tokenId, address auth) internal virtual override returns (address) {
    if (auth != address(0x0)) {
      if (auth == _vestingLocks[tokenId].vestingAdmin && _vestingLocks[tokenId].adminTransferOBO) {
        return super._update(to, tokenId, auth);
      } else {
        require(_vestingLocks[tokenId].transferable, '!transferable');
        return super._update(to, tokenId, auth);
      }
    }
  }

  function _isAuthorized(
    address owner,
    address spender,
    uint256 tokenId
  ) internal view virtual override returns (bool) {
    return
      spender != address(0) &&
      (owner == spender ||
        isApprovedForAll(owner, spender) ||
        _getApproved(tokenId) == spender ||
        spender == _vestingLocks[tokenId].vestingAdmin);
  }
}
