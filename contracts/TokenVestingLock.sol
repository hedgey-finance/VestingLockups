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

/// @title TokenVestingLock
/// @notice This contract is used exclusively as an add-module for the Hedgey Vesting Plans to allow an additional lockup mechanism for tokens that are vesting
/// This contract will point to exactly one specific Hedgey Vesting contract, and it will allow for the holder of the plan to redeem their vesting tokens
/// but will conform to an additional lockup schedule where vested tokens are subject to the lockup, and can only be fully redeemed by the beneficiary
/// based on the combined vesting and lockups schedules.
/// @dev this contract is an ERC721 Enumerable extenstion that physically holds the Hedgey Vesting NFTs and issues recipients an NFT representing both the vesting and lockup schedule
/// @author iceman from Hedgey

contract TokenVestingLock is ERC721Delegate, ReentrancyGuard, ERC721Holder {
  /// @dev this is the implementation stored of the specific Hedgey Vesting contract this particular lockup contract is tied to
  IVesting public hedgeyVesting;

  /// @notice for security only a special hedgey plan creator address is able to mint these NFTs in addition to vesting admin of a plan
  address public hedgeyPlanCreator;

  string public baseURI;
  /// @dev manager for setting the baseURI & hedgeyPlanCreator contract;
  address internal manager;

  /// @notice the internal counter of tokenIds that will be mapped to each vestinglock object and the associated NFT
  uint256 internal _tokenIds;

  /// @notice a struct that is used for creation of a new lockup that defines the beneficiary and if the vesting admin can redeem on behalf
  struct Recipient {
    address beneficiary;
    bool adminRedeem;
  }

  /// @notice primary struct defining the vesting lockup and its schedule
  /// @param token is the address of the token that is locked up and vesting
  /// @param totalAmount is the total amount - this comes from the vesting plan at inception and has to match
  /// @param availableAmount is the actual amount of tokens that have vested and been redeemed into this contract that are maximally available to unlock at any time
  /// @param start is the start date of the lockup schedule in block time
  /// @param cliff is the cliff date of the lockup schedule in block time
  /// @param rate is the rate at which tokens unlock per period. So if the rate is 100 and period is 1, then 100 tokens unlock per 1 second
  /// @param period is the length of each discrete period. a "streaming" version uses a period of 1 for 1 second but daily is 86400 as example
  /// @param vestingTokenId is the specific NFT token ID that is tied to the vesting plan
  /// @param vestingAdmin is the administrator on the vesting plan, this is the only address that can edit the lockup schedule
  /// @param transferable this is a toggle that the admin can define and allow the NFT to be transferred to another wallet by the owner of the lockup
  /// @param adminTransferOBO this is a toggle that would led the vestingAdmin transfer the lockup NFT to another wallet on behalf of the owner in case of emergency
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

  /// @notice this is mapping of the VestingLock struct to the tokenIds which represent each NFT
  mapping(uint256 => VestingLock) internal _vestingLocks;

  /// @notice this is a mapping of the vestingTokenIds that have been allocted to a lockup NFT so that lockup NFTs are always mapped ONLY one to one to a vesting plan
  mapping(uint256 => bool) internal _allocatedVestingTokenIds;

  /// @notice this is a mapping of the approved redeemeers that can redeem the vested tokens or unlock the unlocked tokens, used as a mechanism for redeeming on behalf
  /// @dev if the user sets the zero address to be true, then it is a global approval for anyone to redeem
  mapping(uint256 => mapping(address => bool)) internal _approvedRedeemers;

  /// @notice separate mapping specifically defining if the vestingAdmin can redeem on behalf of end users
  mapping(uint256 => bool) internal _adminRedeem;

  /// @notice this is a mapping of the voting vaults owned by the locked NFTs specifically used for onchain voting and delegation
  mapping(uint256 => address) public votingVaults;

  /*************EVENTS****************************************************************************************************/
  /// @notice events
  event VestingLockupCreated(
    uint256 indexed lockId,
    uint256 indexed vestingTokenId,
    address indexed beneficiary,
    VestingLock lock,
    uint256 lockEnd
  );
  event TokensUnlocked(uint256 indexed lockId, uint256 unlockedAmount, uint256 remainingTotal, uint256 unlockTime);
  event VestingRedeemed(
    uint256 indexed lockId,
    uint256 indexed vestingId,
    uint256 redeemedAmount,
    uint256 availableAmount,
    uint256 totalAmount
  );
  event LockEdited(uint256 indexed lockId, uint256 start, uint256 cliff, uint256 rate, uint256 period, uint256 end);

  event RedeemerApproved(uint256 indexed lockId, address redeemer);
  event RedeemerRemoved(uint256 indexed lockId, address redeemer);
  event AdminRedemption(uint256 indexed lockId, bool enabled);
  event VotingVaultCreated(uint256 indexed lockId, address votingVault);

  event VestingAdminUpdated(uint256 indexed lockId, address newAdmin);
  event TransferabilityUpdated(uint256 indexed lockId, bool transferable);

  event URISet(string newURI);
  event ManagerChanged(address newManager);
  event PlanCreatorChanged(address newPlanCreator);

  /*************CONSTRUCTOR & URI ADMIN FUNCTIONS****************************************************************************************************/

  /// @notice the constructor maps the specific hedgey vesting contract at inception and takes in the hedgeyPlanCreator address for minting the NFTs
  /// @dev note that these cannot be changed after deployment!
  constructor(
    string memory name,
    string memory symbol,
    address _hedgeyVesting,
    address _hedgeyPlanCreator
  ) ERC721(name, symbol) {
    hedgeyVesting = IVesting(_hedgeyVesting);
    hedgeyPlanCreator = _hedgeyPlanCreator;
    manager = msg.sender;
  }

  modifier onlyManager() {
    require(msg.sender == manager, '!MANAGER');
    _;
  }

  /// @notice override function to deliver custom baseURI
  function _baseURI() internal view override returns (string memory) {
    return baseURI;
  }

  /// @notice function to set the base URI after the contract has been launched, only the admin can call
  /// @param _uri is the new baseURI for the metadata
  function updateBaseURI(string memory _uri) external onlyManager {
    baseURI = _uri;
    emit URISet(_uri);
  }

  /// @notice function to change the admin address
  /// @param newManager is the new address for the admin
  function changeManager(address newManager) external onlyManager {
    manager = newManager;
    emit ManagerChanged(newManager);
  }

  /// @notice function to update the plan creator address in the case of updates to the functionality
  /// @param newCreator is the new address for the plan creator
  /// @dev only the admin can call this function
  function updatePlanCreator(address newCreator) external onlyManager {
    hedgeyPlanCreator = newCreator;
    emit PlanCreatorChanged(newCreator);
  }

  /*****TOKEN ID FUNCTIONS*************************************************************************************/
  /// @notice function to increment the tokenId counter, and returns the current tokenId after inrecmenting
  function incrementTokenId() internal returns (uint256) {
    _tokenIds++;
    return _tokenIds;
  }
  /// @notice function to get the current running total of tokenId, useful for when totalSupply does not match
  function currentTokenId() public view returns (uint256) {
    return _tokenIds;
  }

  /***PUBLIC GETTER FUNCTIONS***************************************************************************************************/

  /// @notice function to get the lock details of a specific lock NFT
  /// @param lockId is the token Id of the NFT
  function getVestingLock(uint256 lockId) public view returns (VestingLock memory) {
    return _vestingLocks[lockId];
  }

  /// @notice function to get the end date of a specific lock NFT
  /// @param lockId is the token Id of the NFT
  function getLockEnd(uint256 lockId) public view returns (uint256 end) {
    VestingLock memory lock = _vestingLocks[lockId];
    end = UnlockLibrary.endDate(lock.start, lock.totalAmount, lock.rate, lock.period);
  }

  /// @notice function to get the balance of a specific lock NFT at the current time
  /// @param lockId is the token Id of the NFT
  /// @dev the unlockedBalance is the amount of tokens that can be unlocked now, with the upper limit of the available amount that has already been vested and redeemed
  /// @dev the locked balance is the amount of tokens still locked based ont he lockup schedule
  /// @dev the unlockTime is the timestamp when the lock resets based on how many periods were able to be unlocked
  function getLockBalance(
    uint256 lockId
  ) public view returns (uint256 unlockedBalance, uint256 lockedBalance, uint256 unlockTime) {
    VestingLock memory lock = _vestingLocks[lockId];
    (unlockedBalance, lockedBalance, unlockTime) = UnlockLibrary.balanceAtTime(
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

  /// @notice function to approve a new redeemer who can call the redeemVesting or unlock functions
  /// @param lockId is the token Id of the NFT
  /// @param redeemer is the address of the new redeemer (it can be the zero address)
  /// @dev only owner of the NFT can call this function
  /// @dev if the zero address is set to true, then it becomes publicly avilable for anyone to redeem
  function approveRedeemer(uint256 lockId, address redeemer) external {
    require(msg.sender == ownerOf(lockId), '!owner');
    _approvedRedeemers[lockId][redeemer] = true;
    emit RedeemerApproved(lockId, redeemer);
  }

  /// @notice function to remove an approved redeemer
  /// @param lockId is the token Id of the NFT
  /// @param redeemer is the address of the redeemer to be removed
  /// @dev this function simply deletes the storage of the approved redeemer
  function removeRedeemer(uint256 lockId, address redeemer) external {
    require(msg.sender == ownerOf(lockId), '!owner');
    delete _approvedRedeemers[lockId][redeemer];
    emit RedeemerRemoved(lockId, redeemer);
  }

  /// @notice function to set the admin redemption toggle on a specific lock NFT
  /// @param lockId is the token Id of the NFT
  /// @param enabled is the boolean toggle to allow the vesting admin to redeem on behalf of the owner
  function setAdminRedemption(uint256 lockId, bool enabled) external {
    require(msg.sender == ownerOf(lockId), '!owner');
    _adminRedeem[lockId] = enabled;
    emit AdminRedemption(lockId, enabled);
  }

  /// @notice function to check if the admin can redeem on behalf of the owner
  /// @param lockId is the token Id of the NFT
  /// @param admin is the address of the admin
  function adminCanRedeem(uint256 lockId, address admin) public view returns (bool) {
    return (_adminRedeem[lockId] && admin == _vestingLocks[lockId].vestingAdmin);
  }

  /// @notice function to check if a specific address is an approved redeemer
  /// @param lockId is the token Id of the NFT
  /// @param redeemer is the address of the redeemer
  /// @dev will return true if the redeemer is the owner of the NFT, if the redeemer is approved or if the 0x0 address is approved, or if the redeemer is the admin address
  function isApprovedRedeemer(uint256 lockId, address redeemer) public view returns (bool) {
    address owner = ownerOf(lockId);
    return (owner == redeemer ||
      _approvedRedeemers[lockId][redeemer] ||
      _approvedRedeemers[lockId][address(0x0)] ||
      adminCanRedeem(lockId, redeemer));
  }

  /******CORE EXTERNAL FUNCTIONS *********************************************************************************************/

  /// @notice function to create a new lockup NFT for a vesting plan
  /// @param recipient is the struct that defines the beneficiary and if the vesting admin can redeem on behalf
  /// @param vestingTokenId is the specific NFT token ID that is tied to the vesting plan
  /// @param start is the start date of the lockup schedule in block time
  /// @param cliff is the cliff date of the lockup schedule in block time
  /// @param rate is the rate at which tokens unlock per period
  /// @param period is the length of each discrete period
  /// @param transferable is the toggle that allows the NFT to be transferred to another wallet by the owner of the lockup
  /// @param adminTransferOBO is the toggle that would led the vestingAdmin transfer the lockup NFT to another wallet on behalf of the owner in case of emergency
  /// @dev this function will check that the vesting plan is owned by this contract, and that the vesting plan is not already allocated to a lockup NFT
  /// the function will also check that the caller is the hedgeyPlanCreator or the vestingAdmin of the plan
  /// the function will automatically set the totalAmount to the vesting plan amount, the token address to the vesting plan token address, and the vesting admin to the vestingAdmin of the vesting plan
  /// the function will perform a special check, if the plan is set to unlock the tokens all at once on a single date - where the rate is equal to the total amount
  /// then it will set the period to 1. Otherwise it will check that the lock end is greater than or equal to the vesting end
  /// the function will increment the tokenIds counter and store the new lockup NFT in the _vestingLocks mapping
  /// the function will then safeMint the new NFT to the recipient
  /// the function will toggle the vestingAdminTransfer to false for the vesting plan so that it cannot be pulled out of the lockup contract without approval from the recipient
  /// @dev this function is called either at the creation of both a new vesting plan with a lockup, which is the most common use case and done by the hdedgeyPlanCreator
  /// or it can be done after the fact if a vesting plan is transferred into this contract, and then the vesting admin calls this function to add a lockup schedule to the unallocated vesting plan
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
    require(_allocatedVestingTokenIds[vestingTokenId] == false, 'allocated');
    require(hedgeyVesting.ownerOf(vestingTokenId) == address(this), '!ownerOfNFT');
    _allocatedVestingTokenIds[vestingTokenId] = true;
    address vestingAdmin = hedgeyVesting.plans(vestingTokenId).vestingAdmin;
    require(msg.sender == hedgeyPlanCreator || msg.sender == vestingAdmin);
    uint256 totalAmount = hedgeyVesting.plans(vestingTokenId).amount;
    if (rate == totalAmount) period = 1;
    address token = hedgeyVesting.plans(vestingTokenId).token;
    uint256 vestingEnd = hedgeyVesting.planEnd(vestingTokenId);
    uint256 lockEnd = UnlockLibrary.validateEnd(start, cliff, totalAmount, rate, period, vestingEnd);
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
    _safeMint(recipient.beneficiary, newLockId);
    hedgeyVesting.toggleAdminTransferOBO(vestingTokenId, false);
    emit VestingLockupCreated(newLockId, vestingTokenId, recipient.beneficiary, _vestingLocks[newLockId], lockEnd);
  }

  /// @notice function to redeem the vested tokens and immediateyl unlock whatever is available for multiple vesting lockups
  /// @param lockIds is the array of tokenIds of the lockup NFTs
  /// @dev this function will iterate through the array of lockIds and call the internal _redeemVesting function and then immediately call the internal _unlock function
  /// the function will pull any tokens that are vested into this contract, and then unlock any avilable and unlocked tokens and transfer them to the owner of the NFT - the beneficiary
  /// if there is nothing vested or unlocked, it will simply skip the redemption & unlocking and move onto the next tokenId rather than reverting the whole transaction
  /// this allows for a vestingAdmin who is redeeming on behalf of a group of users to redeem all of the tokens they are an admin for without having to calculate which ones have available balances and which do not
  function redeemAndUnlock(
    uint256[] calldata lockIds
  )
    external
    nonReentrant
    returns (uint256[] memory redeemedBalances, uint256[] memory vestingRemainder, uint256[] memory unlockedBalances)
  {
    redeemedBalances = new uint256[](lockIds.length);
    vestingRemainder = new uint256[](lockIds.length);
    unlockedBalances = new uint256[](lockIds.length);
    for (uint256 i = 0; i < lockIds.length; i++) {
      (redeemedBalances[i], vestingRemainder[i]) = _redeemVesting(lockIds[i]);
      unlockedBalances[i] = _unlock(lockIds[i]);
    }
  }

  /// @notice function to unlock tokens from an lockup
  /// @param lockIds is the array of tokenIds of the lockup NFTs
  /// @dev this function assumes that there are tokens that are vested and have already been redeemed and pulled into this contract that are now just locked and ready to be unlocked
  /// if there is nothing to unlock the function will not revert but no tokens will be moved
  function unlock(uint256[] calldata lockIds) external nonReentrant returns (uint256[] memory unlockedBalances) {
    unlockedBalances = new uint256[](lockIds.length);
    for (uint256 i = 0; i < lockIds.length; i++) {
      unlockedBalances[i] = _unlock(lockIds[i]);
    }
  }
  /// @notice function to redeem the vested tokens from the vesting plan associated with a specific lockup
  /// @param lockIds is the array of tokenIds of the lockup NFTs
  /// @dev this function will redeem anything that has vested, and the vested tokens will be pulled into this contract
  /// if there are no vested tokens for a specific plan, it will not revert but simply skip it on underlying the vesting contract logic itself
  function redeemVestingPlans(
    uint256[] calldata lockIds
  ) external nonReentrant returns (uint256[] memory balances, uint256[] memory remainders) {
    balances = new uint256[](lockIds.length);
    remainders = new uint256[](lockIds.length);
    for (uint256 i = 0; i < lockIds.length; i++) {
      (balances[i], remainders[i]) = _redeemVesting(lockIds[i]);
    }
  }

  /// @notice function to burn a lockup NFT where the vesting plan NFT has been revoked and is burned
  /// @param lockId is the token Id of the lockup NFT associated with the revoked vesting plan
  /// @dev this function requires only the owner of the lockup NFT to call it
  /// it will check that the available amount is 0, so that the owner is not burning an NFT and thus losing the tokens that are still locked
  /// it will the use the try / catch patter to attempt to see if this contract is still the owner of the vesting plan.
  /// if this contract is still the owner, then it will revert as clearly the vesting plan has not been burned
  /// if the vesting plan is not owned by this contract anymore, then it will burn the lockup NFT and delete all storage of the lockup NFT
  /// @dev this does allow for the ability for a vestingAdmin to transfer the vestingPlan out of this contract, then the owner to burn this NFT even if the vesting plan is still active
  /// used only for emergency purposes where a mistake was made and the vesting plan was not supposed to be locked up or the lockup was wrong and needs to be adjusted
  /// but since only the owner of the lockup can burn the lock NFT, this allows there to be a safety mechanism in place
  /// such that it can be assumed there is agreement between the owner and the vestingAdmin to perform this emergency action
  function burnRevokedVesting(uint256 lockId) external {
    require(msg.sender == ownerOf(lockId), '!owner');
    VestingLock memory lock = _vestingLocks[lockId];
    require(lock.availableAmount == 0);
    try hedgeyVesting.ownerOf(lock.vestingTokenId) {
      require(hedgeyVesting.ownerOf(lock.vestingTokenId) != address(this), '!revoked');
      _burn(lockId);
      delete _vestingLocks[lockId];
      delete _allocatedVestingTokenIds[lock.vestingTokenId];
    } catch {
      _burn(lockId);
      delete _vestingLocks[lockId];
      delete _allocatedVestingTokenIds[lock.vestingTokenId];
    }
  }

  /************CORE INTERNAL FUNCTIONS**************************************************************************************************/

  /// @notice internal function to unlock tokens available for a specific lockup NFT
  /// @param lockId is the token Id of the vestinglock NFT
  /// @dev this function will check that the msg sender is an approved redeemer
  /// then it will get the available balances that can be unlocked at the current time
  /// @dev if the unlocked balance is 0, the function will simply return 0 as the unlocked Balance and will not process anything further
  /// @dev if the function has an available unlocked balance it will check if the tokens are held externally at a voting vault
  /// and then transfer the amount of unlocked tokens from either the voting vualt or this contract to the beneficiary and owner of the lock NFT
  /// if the remaining total is now equal to 0, ie the total amount less the unlocked balance, then the vesting plan is burned and we can burn the lock NFT and delete it from storage
  /// otherwise we will update the available amount to be the lockedBalance - where the locked balance only includes the available amount that has been physically vested and pulled into this contract already
  /// update the start time to the unlock time
  /// and update the totalAmount to be the reaminig total amount which is the initial lock total amount less the unlocked balance
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
    if (votingVaults[lockId] != address(0)) {
      VotingVault(votingVaults[lockId]).withdrawTokens(ownerOf(lockId), unlockedBalance);
    } else {
      TransferHelper.withdrawTokens(lock.token, ownerOf(lockId), unlockedBalance);
    }
    uint256 remainingTotal = lock.totalAmount - unlockedBalance;
    if (remainingTotal == 0) {
      _burn(lockId);
      delete _vestingLocks[lockId];
    } else {
      _vestingLocks[lockId].availableAmount = lockedBalance;
      _vestingLocks[lockId].start = unlockTime;
      _vestingLocks[lockId].totalAmount = remainingTotal;
    }
    emit TokensUnlocked(lockId, unlockedBalance, remainingTotal, unlockTime);
  }

  /// @notice function to redeem the vested tokens from the vesting plan associated with a specific lockup
  /// @param lockId is the token Id of the vestingLock NFT
  /// @dev this function will check that the msg sender is an approved redeemer
  /// @dev the function will check that the vesting plan is owned by this contract. If it is not then it will simply return 0,0
  /// the function then checks the balance and remainder coming from the vesting plan contract itself. If the balance returns 0, then it will simply return 0,0
  /// the function then calls the redeemPlans function on the vesting plan contract to redeem the vested tokens
  /// the function performs a check ensuring that the balance calculated is the difference between the amount of tokens this contract holds before plus the redeemed balance equals the amount of tokens after
  /// the function then updates the available amount of the vestingLock struct to add the newly received redeemed balance of tokens
  /// then it will update the totalAmount of the lockup to equal the remainder of the vestingPlan plus available amount
  /// so that the total equals the amount still held by the vesting plan contract, and the amount held by this contract address
  // finally the function checks if the lockup has setup a voting vault, and if so it will transfer the tokens to the voting vault from this address
  function _redeemVesting(uint256 lockId) internal returns (uint256 balance, uint256 remainder) {
    require(isApprovedRedeemer(lockId, msg.sender), '!approved');
    uint256 vestingId = _vestingLocks[lockId].vestingTokenId;
    require(_allocatedVestingTokenIds[vestingId], 'not allocated');
    try hedgeyVesting.ownerOf(vestingId) {
      require(hedgeyVesting.ownerOf(vestingId) == address(this), '!ownerOfNFT');
    } catch {
      return (0, 0);
    }
    (balance, remainder, ) = hedgeyVesting.planBalanceOf(vestingId, block.timestamp, block.timestamp);
    if (balance == 0) {
      return (0, 0);
    }
    uint256 preRedemptionBalance = IERC20(_vestingLocks[lockId].token).balanceOf(address(this));
    uint256[] memory vestingIds = new uint256[](1);
    vestingIds[0] = vestingId;
    hedgeyVesting.redeemPlans(vestingIds);
    uint256 postRedemptionBalance = IERC20(_vestingLocks[lockId].token).balanceOf(address(this));
    require(postRedemptionBalance - preRedemptionBalance == balance, 'redeem error');
    _vestingLocks[lockId].availableAmount += balance;
    _vestingLocks[lockId].totalAmount = _vestingLocks[lockId].availableAmount + remainder;
    if (votingVaults[lockId] != address(0)) {
      TransferHelper.withdrawTokens(_vestingLocks[lockId].token, votingVaults[lockId], balance);
    }
    emit VestingRedeemed(
      lockId,
      vestingId,
      balance,
      _vestingLocks[lockId].availableAmount,
      _vestingLocks[lockId].totalAmount
    );
  }

  /************************************VESTING ADMIN FUNCTIONS**********************************************************/

  /// @notice function for the vesting admin to change their address to a new admin.
  /// @param lockIds is the array of tokenIds of the lockup NFTs
  /// @param newAdmin is the address of the new vesting admin
  /// @dev this function allows an admin to transfer in bulk
  /// @dev this function will check that the msg.sender is either the current admin, or the new vesting plan admin
  /// for the case where they have changed their address on the vesting plan contract and need to adjust it on the lockup contract as well
  /// this function just updates the vestingAdmin storage for each plan to the new admin
  function updateVestingAdmin(uint256[] memory lockIds, address newAdmin) external {
    for (uint16 i; i < lockIds.length; i++) {
      uint256 lockId = lockIds[i];
      address vestingAdmin = hedgeyVesting.plans(_vestingLocks[lockId].vestingTokenId).vestingAdmin;
      require(msg.sender == _vestingLocks[lockId].vestingAdmin || msg.sender == vestingAdmin, '!vestingAdmin');
      _vestingLocks[lockId].vestingAdmin = newAdmin;
      emit VestingAdminUpdated(lockId, newAdmin);
    }
  }

  /// @notice function to update the transferability of a specific lock NFT
  /// @param lockIds is the array of tokenIds of the lockup NFTs
  /// @param transferable is a boolean toggle that allows the NFT to be transferred to another wallet by the owner of the lockup
  /// @dev this function simply checks that only the current vestingAdmin can make this adjustment, and then updates the storage accordingly
  function updateTransferability(uint256[] memory lockIds, bool transferable) external {
    for (uint16 i; i < lockIds.length; i++) {
      require(msg.sender == _vestingLocks[lockIds[i]].vestingAdmin, '!vestingAdmin');
      _vestingLocks[lockIds[i]].transferable = transferable;
      emit TransferabilityUpdated(lockIds[i], transferable);
    }
  }

  /// @notice function to allow the admin to edit the lock details for a lock that hasn't started yet
  /// @param lockId is the token Id of the lockup NFT
  /// @param start is the start date of the new lockup schedule
  /// @param cliff is the cliff date of the new lockup schedule
  /// @param rate is the rate at which tokens unlock per period
  /// @param period is the length of each discrete period
  /// @dev this function can Only be called before the later of the start or the cliff - ie the lock must effectively not have started or have anything unlocked to change it
  /// the function can only be called by the existing vesting admin
  /// the function will update the vestinglock storage with the new start, cliff, rate, and period parameters
  /// the function will also double check and update the vesting plan to pull in the new total amount, being the available amount and the amount still in the vesting plan
  /// the function then validates that the end date
  function editLockDetails(uint256 lockId, uint256 start, uint256 cliff, uint256 rate, uint256 period) external {
    VestingLock storage lock = _vestingLocks[lockId];
    require(msg.sender == lock.vestingAdmin, '!vestingAdmin');
    // must be before the later of the start or cliff
    uint256 editableDate = lock.start > lock.cliff ? lock.start : lock.cliff;
    require(block.timestamp < editableDate, '!editable');
    lock.start = start;
    lock.cliff = cliff;
    lock.rate = rate;
    lock.totalAmount = hedgeyVesting.plans(lock.vestingTokenId).amount + lock.availableAmount;
    lock.period = rate == lock.totalAmount ? 1 : period;
    uint256 vestingEnd = hedgeyVesting.planEnd(lock.vestingTokenId);
    uint256 end = UnlockLibrary.validateEnd(start, cliff, lock.totalAmount, rate, lock.period, vestingEnd);
    emit LockEdited(lockId, start, cliff, rate, lock.period, end);
  }

  /*****************BENEFICIARY TRANSFERABILITY TOGGLES**********************************************************************/

  /// @notice function to allow the admin to transfer on behalf of the beneficial owner of the vesting lock NFT
  /// @param lockId is the token Id of the vesting lock NFT
  /// @param adminTransferOBO is the boolean toggle that would led the vestingAdmin transfer the lockup NFT to another wallet on behalf of the owner in case of emergency
  function updateAdminTransferOBO(uint256 lockId, bool adminTransferOBO) external {
    require(msg.sender == ownerOf(lockId), '!owner');
    _vestingLocks[lockId].adminTransferOBO = adminTransferOBO;
  }

  /// @notice function to allow the admin of the actual vesting plan to transfer the vesting plan out of this contract
  /// @param lockId is the token Id of the vesting lock NFT
  /// @param transferable is the a boolean toggle recorded in storage on the vesting contract that determines it the vestingAdmin can transfer the vesting plan to another wallet
  /// @dev this function should be used carefully as it allows the vestingAdmin to transfer the vesting plan out of this contract - meaning the lockup will no longer be tied to the vesting plan
  /// transferring the vesting plan out may be used in case of emergency, but it will also mean the lockup is no longer valid to redeem vesting anymore
  function updateVestingTransferability(uint256 lockId, bool transferable) external {
    require(msg.sender == ownerOf(lockId), '!owner');
    hedgeyVesting.toggleAdminTransferOBO(_vestingLocks[lockId].vestingTokenId, transferable);
  }

  /***************DELEGATION FUNCTION FOR VESTING PLANS**********************************************************************************/

  /// @notice function to delegate multiple plans to multiple delegates in a single transaction
  /// @param lockIds is the array of tokenIds of the lockup NFTs
  /// @param delegatees is the array of addresses that each corresponding planId will be delegated to
  /// @dev this function will call the underlying vesting plan contract and delegate the tokens to the delegatee
  function delegatePlans(uint256[] calldata lockIds, address[] calldata delegatees) external nonReentrant {
    require(lockIds.length == delegatees.length, 'array error');
    for (uint256 i; i < lockIds.length; i++) {
      require(_isApprovedDelegatorOrOwner(msg.sender, lockIds[i]), '!approved');
    }
    hedgeyVesting.delegatePlans(lockIds, delegatees);
  }

  /***************DELEGATION FUNCTION FOR ERC721DELEGATE CONTRACT**********************************************************************************/

  /// @notice functeion to delegate multiple plans to multiple delegates in a single transaction
  /// @dev this also calls the internal _delegateToken function from ERC721Delegate.sol to delegate an NFT to another wallet.
  /// @dev this function iterates through the array of plans and delegatees, delegating each individual NFT.
  /// @param lockIds is the array of planIds that will be delegated
  /// @param delegatees is the array of addresses that each corresponding planId will be delegated to
  function delegateLockNFTs(uint256[] calldata lockIds, address[] calldata delegatees) external nonReentrant {
    require(lockIds.length == delegatees.length);
    for (uint256 i; i < lockIds.length; i++) {
      _delegateToken(delegatees[i], lockIds[i]);
    }
  }

  /***************DELEGATION FUNCTION FOR ONCHAIN VOTING**********************************************************************************/

  /// @notice this function allows an owner of multiple vesting plans to delegate multiple of them in a single transaction, each planId corresponding to a delegatee address
  /// @dev this function should only be used for onchain voting and delegation with an ERC20Votes token
  /// @param lockIds is the ids of the vesting plan and NFT
  /// @param delegatees is the array of addresses where each vesting plan will delegate the tokens to
  function delegateLockPlans(
    uint256[] calldata lockIds,
    address[] calldata delegatees
  ) external nonReentrant returns (address[] memory) {
    require(lockIds.length == delegatees.length);
    address[] memory vaults = new address[](lockIds.length);
    for (uint256 i; i < lockIds.length; i++) {
      vaults[i] = _delegate(lockIds[i], delegatees[i]);
    }
    return vaults;
  }

  /**************************INTERNAL ONCHAIN VOTING FUNCTIONS*************************************************************************************************************/

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
    // require(lock.availableAmount > 0, '!balance');
    VotingVault vault = new VotingVault(lock.token, ownerOf(lockId));
    votingVaults[lockId] = address(vault);
    if (lock.availableAmount > 0) TransferHelper.withdrawTokens(lock.token, address(vault), lock.availableAmount);
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

  /******************************PUBLIC AGGREGATE VIEW FUNCTIONS ***********************************************************************/

  /// @notice this function will aggregate the available amount for a specific holder across all of their plans, based on a single ERC20 token
  /// @param holder is the address of the beneficiary who owns the vesting plan(s)
  /// @param token is the ERC20 address of the token that is stored across the vesting plans
  function lockedBalances(address holder, address token) external view returns (uint256 lockedBalance) {
    uint256 holdersBalance = balanceOf(holder);
    for (uint256 i; i < holdersBalance; i++) {
      uint256 lockId = tokenOfOwnerByIndex(holder, i);
      VestingLock memory lock = _vestingLocks[lockId];
      if (token == lock.token) {
        lockedBalance += lock.availableAmount;
      }
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

  /*******INTERNAL NFT TRANSFERABILITY UPDATES*********************************************************************************/

  /// @notice function that overrides the internal OZ logic to manage the transferability of the NFT
  /// @dev if the auth address is the 0x0 address, then its either mint or burn and we do not need to perform any additional checks
  /// @dev if the auth address is not the 0x0 address, then it will check if the auth address (spender) is the vesting admin, and if it is, will process the transfer and check if the admintransfertoggle is on
  /// we have the function set specifically to check when auth is the vesting admin so that the _isAuthorzied can check if the adminTransferOBO is on
  /// or if the admin has specifically been approved to transfer on behalf of the owner, then it can be done once by the admin in the normal _getApproved function
  /// otherwise we check if the lockup is transferable and then perform the transfer
  function _update(address to, uint256 tokenId, address auth) internal virtual override returns (address) {
    if (auth != address(0x0)) {
      if (auth == _vestingLocks[tokenId].vestingAdmin) {
        return super._update(to, tokenId, auth);
      } else {
        require(_vestingLocks[tokenId].transferable, '!transferable');
        return super._update(to, tokenId, auth);
      }
    } else {
      _updateDelegate(to, tokenId);
      return super._update(to, tokenId, address(0x0));
    }
  }

  /// @notice this function overrides the internal isAuthorized function specifically for when the vestingAdmin is the spender, and check if the adminTransferOBO is on
  /// @dev we update the authorization logic instead of the update logic for the adminTransferOBO toggle as we want to check this whenever the admin is the spender
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
        (spender == _vestingLocks[tokenId].vestingAdmin && _vestingLocks[tokenId].adminTransferOBO));
  }
}
