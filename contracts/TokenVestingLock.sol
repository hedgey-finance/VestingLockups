// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.24;

import '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import './ERC721Delegate/ERC721Delegate.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol';

import './libraries/UnlockLibrary.sol';
import './libraries/TransferHelper.sol';
import './interfaces/IVesting.sol';
import './periphery/VotingVault.sol';

import 'hardhat/console.sol';

contract TokenVestingLock is ERC721Delegate, ReentrancyGuard, ERC721Holder {
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

  event VestingLockupCreated(uint256 indexed lockId, uint256 indexed vestingTokenId, address indexed beneficiary, VestingLock lock, uint256 lockEnd);
  event TokensUnlocked(uint256 indexed lockId, uint256 unlockedAmount, uint256 remainingTotal, uint256 unlockTime);
  event VestingRedeemed(uint256 indexed lockId, uint256 indexed vestingId, uint256 redeemedAmount, uint256 availableAmount, uint256 totalAmount);
  event LockEdited(uint256 indexed lockId, uint256 start, uint256 cliff, uint256 rate, uint256 period, uint256 end);

  event RedeemerApproved(uint256 indexed lockId, address redeemer);
  event RedeemerRemoved(uint256 indexed lockId, address redeemer);
  event AdminRedemption(uint256 indexed lockId, bool enabled);
  event VotingVaultCreated(uint256 indexed lockId, address votingVault);

  event VestingAdminUpdated(uint256 indexed lockId, address newAdmin);
  event TransferabilityUpdated(uint256 indexed lockId, bool transferable);

  /// @notice event for when a new URI is set for the NFT metadata linking
  event URISet(string newURI);

  /// @notice event for when the URI admin is deleted
  event URIAdminDeleted(address _admin);

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

  function _baseURI() internal view override returns (string memory) {
    return baseURI;
  }

  /// @notice function to set the base URI after the contract has been launched, only the admin can call
  /// @param _uri is the new baseURI for the metadata
  function updateBaseURI(string memory _uri) external {
    require(msg.sender == uriAdmin, '!ADMIN');
    baseURI = _uri;
    uriSet = true;
    emit URISet(_uri);
  }

  /// @notice function to delete the admin once the uri has been set
  function deleteAdmin() external {
    require(msg.sender == uriAdmin, '!ADMIN');
    require(uriSet, '!SET');
    delete uriAdmin;
    emit URIAdminDeleted(msg.sender);
  }

  /*****TOKEN ID FUNCTIONS*************************************************************************************/

  function incrementTokenId() internal returns (uint256) {
    _tokenIds++;
    return _tokenIds;
  }

  function currentTokenId() public view returns (uint256) {
    return _tokenIds;
  }

/***PUBLIC GETTER FUNCTIONS***************************************************************************************************/
  function getVestingLock(uint256 lockId) public view returns (VestingLock memory) {
    return _vestingLocks[lockId];
  }

  function getLockEnd(uint256 lockId) public view returns (uint256 end) {
    VestingLock memory lock = _vestingLocks[lockId];
    end = UnlockLibrary.endDate(lock.start, lock.totalAmount, lock.rate, lock.period);
  }

  function getLockBalance(uint256 lockId) public view returns (uint256 available, uint256 locked, uint256 unlockTime) {
    VestingLock memory lock = _vestingLocks[lockId];
    (available, locked, unlockTime) = UnlockLibrary.balanceAtTime(
      lock.start,
      lock.cliff,
      lock.totalAmount,
      lock.availableAmount,
      lock.rate,
      lock.period,
      block.timestamp
    );
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
    require(_allocatedVestingTokenIds[vestingTokenId] == false, 'allocated');
    require(hedgeyVesting.ownerOf(vestingTokenId) == address(this), '!ownerOfNFT');
    _allocatedVestingTokenIds[vestingTokenId] = true;
    address vestingAdmin = hedgeyVesting.plans(vestingTokenId).vestingAdmin;
    require(msg.sender == hedgeyPlanCreator || msg.sender == vestingAdmin);
    uint256 totalAmount = hedgeyVesting.plans(vestingTokenId).amount;
    address token = hedgeyVesting.plans(vestingTokenId).token;
    uint256 vestingEnd = hedgeyVesting.planEnd(vestingTokenId);
    (uint256 lockEnd, bool valid) = UnlockLibrary.validateEnd(start, cliff, totalAmount, rate, period);
    require(valid, 'invalid end');
    if (rate == totalAmount) {
      period = 1;
    } else {
      require(lockEnd >= vestingEnd, 'end error');
    }
    newLockId = incrementTokenId();
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
    emit VestingLockupCreated(newLockId, vestingTokenId, recipient.beneficiary, _vestingLocks[newLockId], lockEnd);
  }

  function redeemAndUnlock(uint256[] calldata lockIds) external nonReentrant returns (uint256[] memory redeemedBalances, uint256[] memory vestingRemainder, uint256[] memory unlockedBalances) {
    redeemedBalances = new uint256[](lockIds.length);
    vestingRemainder = new uint256[](lockIds.length);
    unlockedBalances = new uint256[](lockIds.length);
    for (uint256 i = 0; i < lockIds.length; i++) {
      (redeemedBalances[i], vestingRemainder[i]) = _redeemVesting(lockIds[i]);
      unlockedBalances[i] = _unlock(lockIds[i]);
    }
  }

  function unlock(uint256[] calldata lockIds) external nonReentrant returns (uint256[] memory unlockedBalances) {
    unlockedBalances = new uint256[](lockIds.length);
    for (uint256 i = 0; i < lockIds.length; i++) {
      unlockedBalances[i] = _unlock(lockIds[i]);
    }
  }

  function redeemVestingPlans(uint256[] calldata lockIds) external nonReentrant returns (uint256[] memory balances, uint256[] memory remainders) {
    balances = new uint256[](lockIds.length);
    remainders = new uint256[](lockIds.length);
    for (uint256 i = 0; i < lockIds.length; i++) {
      (balances[i], remainders[i]) = _redeemVesting(lockIds[i]);
    }
  }

  

  function burnRevokedVesting(uint256 lockId) external {
    require(msg.sender == ownerOf(lockId), '!owner');
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

  function _unlock(uint256 lockId) internal returns (uint256 unlockedBalance) {
    require(isApprovedRedeemer(lockId, msg.sender), '!approved');
    VestingLock memory lock = _vestingLocks[lockId];
    uint256 lockedBalance;
    uint256 unlockTime;
    (unlockedBalance, lockedBalance, unlockTime) = UnlockLibrary.balanceAtTime(
      lock.start,
      lock.cliff,
      lock.totalAmount,
      lock.availableAmount,
      lock.rate,
      lock.period,
      block.timestamp
    );
    if (unlockedBalance == 0) {
      return 0;
    }
      // transfer balance out
    if (votingVaults[lockId] != address(0)) {
      VotingVault(votingVaults[lockId]).withdrawTokens(ownerOf(lockId), unlockedBalance);
    } else {
      TransferHelper.withdrawTokens(lock.token, ownerOf(lockId), unlockedBalance);
    }
    uint256 remainingTotal = lock.totalAmount - unlockedBalance;
    if (remainingTotal == 0) {
      // need to check that the vesting token has been burned as well
      _burn(lockId);
      delete _vestingLocks[lockId];
    } else {
      _vestingLocks[lockId].availableAmount = lockedBalance;
      _vestingLocks[lockId].start = unlockTime;
      _vestingLocks[lockId].totalAmount = remainingTotal;
    }
    emit TokensUnlocked(lockId, unlockedBalance, remainingTotal, unlockTime);
  }

  function _redeemVesting(uint256 lockId) internal returns (uint256 balance, uint256 remainder) {
    require(isApprovedRedeemer(lockId, msg.sender), '!approved');
    uint256 vestingId = _vestingLocks[lockId].vestingTokenId;
    require(_allocatedVestingTokenIds[vestingId], 'not allocated');
    address vestingOwner;
    try hedgeyVesting.ownerOf(vestingId) {
      vestingOwner = hedgeyVesting.ownerOf(vestingId);
    } catch {
      return (0, 0);
    }
    require(vestingOwner == address(this), '!ownerOfNFT');
    (balance, remainder , ) = hedgeyVesting.planBalanceOf(vestingId, block.timestamp, block.timestamp);
    if (balance == 0) {
      return (0,0);
    }
    uint256 preRedemptionBalance = IERC20(_vestingLocks[lockId].token).balanceOf(address(this));
    uint256[] memory vestingIds = new uint256[](1);
    vestingIds[0] = vestingId;
    hedgeyVesting.redeemPlans(vestingIds);
    uint256 postRedemptionBalance = IERC20(_vestingLocks[lockId].token).balanceOf(address(this));
    require(postRedemptionBalance - preRedemptionBalance == balance, 'redeem error');
    // tokens are pulled into this contract, update the available amount to increase based on the new balanced pulled in
    _vestingLocks[lockId].availableAmount += balance;
    _vestingLocks[lockId].totalAmount = _vestingLocks[lockId].availableAmount + remainder;
    if (votingVaults[lockId] != address(0)) {
      TransferHelper.withdrawTokens(_vestingLocks[lockId].token, votingVaults[lockId], balance);
    }
    emit VestingRedeemed(lockId, vestingId, balance, _vestingLocks[lockId].availableAmount, _vestingLocks[lockId].totalAmount);
  }

  /************************************VESTING ADMIN FUNCTIONS**********************************************************/

  function updateVestingAdmin(uint256 lockId, address newAdmin) external {
    address vestingAdmin = hedgeyVesting.plans(_vestingLocks[lockId].vestingTokenId).vestingAdmin;
    require(msg.sender == _vestingLocks[lockId].vestingAdmin || msg.sender == vestingAdmin, '!vestingAdmin');
    _vestingLocks[lockId].vestingAdmin = newAdmin;
    emit VestingAdminUpdated(lockId, newAdmin);
  }

  function updateTransferability(uint256 lockId, bool transferable) external {
    require(msg.sender == _vestingLocks[lockId].vestingAdmin, '!vestingAdmin');
    _vestingLocks[lockId].transferable = transferable;
    emit TransferabilityUpdated(lockId, transferable);
  }

  function editLockDetails(uint256 lockId, uint256 start, uint256 cliff, uint256 rate, uint256 period) external {
    VestingLock storage lock = _vestingLocks[lockId];
    require(msg.sender == lock.vestingAdmin, '!vestingAdmin');
    // must be before the later of the start or cliff
    uint256 editableDate = lock.start > lock.cliff ? lock.start : lock.cliff;
    require(block.timestamp < editableDate, '!editable');
    lock.start = start;
    lock.cliff = cliff;
    lock.rate = rate;
    lock.period = period;
    lock.totalAmount = hedgeyVesting.plans(lock.vestingTokenId).amount + lock.availableAmount;
    (uint256 end, bool valid) = UnlockLibrary.validateEnd(start, cliff, lock.totalAmount, rate, period);
    require(valid);
    uint256 vestingEnd = hedgeyVesting.planEnd(lock.vestingTokenId);
    require(end >= vestingEnd, 'end error');
    emit LockEdited(lockId, start, cliff, rate, period, end);
  }

  function updateAdminTransferOBO(uint256 lockId, bool adminTransferOBO) external {
    require(msg.sender == ownerOf(lockId), '!owner');
    _vestingLocks[lockId].adminTransferOBO = adminTransferOBO;
  }

  function updateVestingTransferability(uint256 lockId, bool transferable) external {
    require(msg.sender == ownerOf(lockId), '!owner');
    hedgeyVesting.toggleAdminTransferOBO(_vestingLocks[lockId].vestingTokenId, transferable);
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

  /// @notice delegation functions do not move any tokens and do not alter any information about the vesting plan object.
  /// the specifically delegate the NFTs using the ERC721Delegate.sol extension.
  /// Use the dedicated snapshot strategy 'hedgey-delegate' to leverage the delegation functions for voting with snapshot

  /// @notice function to delegate an individual NFT tokenId to another wallet address.
  /// @dev by default all plans are self delegated, this allows for the owner of a plan to delegate their NFT to a different address. This calls the internal _delegateToken function from ERC721Delegate.sol contract
  /// @param lockId is the token Id of the NFT and vesting plan to be delegated
  /// @param delegatee is the address that the plan will be delegated to
  function delegateLock(uint256 lockId, address delegatee) external {
    _delegateToken(delegatee, lockId);
  }

  /// @notice functeion to delegate multiple plans to multiple delegates in a single transaction
  /// @dev this also calls the internal _delegateToken function from ERC721Delegate.sol to delegate an NFT to another wallet.
  /// @dev this function iterates through the array of plans and delegatees, delegating each individual NFT.
  /// @param lockIds is the array of planIds that will be delegated
  /// @param delegatees is the array of addresses that each corresponding planId will be delegated to
  function delegateLocks(uint256[] calldata lockIds, address[] calldata delegatees) external nonReentrant {
    require(lockIds.length == delegatees.length, 'array error');
    for (uint256 i; i < lockIds.length; i++) {
      _delegateToken(delegatees[i], lockIds[i]);
    }
  }

  /// @notice this function will pull all of the tokens locked in vesting plans where the NFT has been delegated to a specific delegatee wallet address
  /// this is useful for the snapshot strategy hedgey-delegate, polling this function based on the wallet signed into snapshot
  /// by default all NFTs are self-delegated when they are minted.
  /// @param delegatee is the address of the delegate where NFTs have been delegated to
  /// @param token is the address of the ERC20 token that is locked in vesting plans and has been delegated
  function delegatedBalances(address delegatee, address token) external view returns (uint256 delegatedBalance) {
    uint256 delegateBalance = balanceOfDelegate(delegatee);
    for (uint256 i; i < delegateBalance; i++) {
      uint256 lockId = tokenOfDelegateByIndex(delegatee, i);
      VestingLock memory lock = _vestingLocks[lockId];
      if (token == lock.token) {
        delegatedBalance += lock.availableAmount;
      }
    }
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
  function delegate(uint256 lockId, address delegatee) external nonReentrant returns (address votingVault) {
    votingVault = _delegate(lockId, delegatee);
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
    require(lock.availableAmount > 0, '!balance');
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
  function _delegate(uint256 lockId, address delegatee) internal returns (address) {
    require(_isApprovedDelegatorOrOwner(msg.sender, lockId), '!delegator');
    address vault = votingVaults[lockId];
    if (votingVaults[lockId] == address(0)) {
      vault = _setupVoting(lockId);
    }
    VotingVault(vault).delegateTokens(delegatee);
    return vault;
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
    } else {
      return super._update(to, tokenId, address(0x0));
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
