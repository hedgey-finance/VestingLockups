// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.24;

library UnlockLibrary {

  /// @notice function to calculate the end date of a plan based on its start, amount, rate and period
  function endDate(uint256 start, uint256 amount, uint256 rate, uint256 period) internal pure returns (uint256 end) {
    end = (amount % rate == 0) ? (amount / rate) * period + start : ((amount / rate) * period) + period + start;
  }

  /// @notice function to validate the end date of a vesting lock
  /// @param start is the start date of the lockup
  /// @param cliff is the cliff date of the lockup
  /// @param amount is the total amount of tokens in the lockup, which would be the entire amount of the vesting plan
  /// @param rate is the amount of tokens that unlock per period
  /// @param period is the seconds in each period, a 1 is a period of 1 second whereby tokens unlock every second
  /// @param vestingEnd is the end date of the vesting plan
  /// @dev this function validates the lockup end date against 0 entry values, plus ensures that the cliff date is at least the same as the end date
  /// and finally it chekcs that if the lock isn't a single date unlock, that the end date is beyond the vesting end date
  function validateEnd(
    uint256 start,
    uint256 cliff,
    uint256 amount,
    uint256 rate,
    uint256 period,
    uint256 vestingEnd
  ) internal pure returns (uint256 end) {
    require(amount > 0, '0_amount');
    require(rate > 0, '0_rate');
    require(rate <= amount, 'rate > amount');
    require(period > 0, '0_period');
    end = endDate(start, amount, rate, period);
    require(cliff <= end, 'cliff > end');
    if (rate < amount) {
      require(end >= vestingEnd, 'end error');
    }
  }

  /// @notice function to calculate the unlocked (claimable) balance, still locked balance, and the most recent timestamp the unlock would take place
  /// the most recent unlock time is based on the periods, so if the periods are 1, then the unlock time will be the same as the redemption time,
  /// however if the period more than 1 second, the latest unlock will be a discrete time stamp
  /// @param start is the start time of the plan
  /// @param cliffDate is the timestamp of the cliff of the plan
  /// @param totalAmount is the total amount of tokens in the vesting plan
  /// @param availableAmount is the total unclaimed amount tokens still in the vesting plan
  /// @param rate is the amount of tokens that unlock per period
  /// @param period is the seconds in each period, a 1 is a period of 1 second whereby tokens unlock every second
  /// @param redemptionTime is the time requested for the plan to be redeemed, this can be the same as the current time or prior to it for partial redemptions
  function balanceAtTime(
    uint256 start,
    uint256 cliffDate,
    uint256 totalAmount,
    uint256 availableAmount,
    uint256 rate,
    uint256 period,
    uint256 redemptionTime
  ) internal pure returns (uint256 unlockedBalance, uint256 lockedBalance, uint256 unlockTime) {
    if (start > redemptionTime || cliffDate > redemptionTime) {
      // if the start date or cliff date are in the future, nothing is unlocked
      lockedBalance = availableAmount;
      unlockTime = start;
      unlockedBalance = 0;
    } else if (availableAmount < rate && totalAmount > rate) {
      // if the available amount is less than the rate, and the total amount is greater than the rate,
      // then it is still mid vesting or unlock stream, and so we cant unlock anything because we need to wait for the available amount to be greater than the rate
      lockedBalance = availableAmount;
      unlockTime = start;
      unlockedBalance = 0;
    } else {
      /// need to make sure clock is set correctly
      uint256 periodsElapsed = (redemptionTime - start) / period;
      uint256 calculatedBalance = periodsElapsed * rate;
      uint256 availablePeriods = availableAmount / rate;
      if (totalAmount <= calculatedBalance && availableAmount <= calculatedBalance) {
        /// if the total and the available are less than the calculated amount, then we can redeem the entire available balance
        lockedBalance = 0;
        unlockTime = start + (period * availablePeriods);
        unlockedBalance = availableAmount;
      } else if (availableAmount < calculatedBalance) {
        // else if the available is less than calculated but total is still more than calculated amount - we are still in the middle of vesting terms
        // so we need to determine the total number of periods we can actually unlock, which is the available amount divided by the rate
        unlockedBalance = availablePeriods * rate;
        lockedBalance = availableAmount - unlockedBalance;
        unlockTime = start + (period * availablePeriods);
      } else {
        // the calculated amount is less than available and total, so we just unlock the calculated amount
        unlockedBalance = calculatedBalance;
        lockedBalance = availableAmount - unlockedBalance;
        unlockTime = start + (period * periodsElapsed);
      }
    }
  }
}
