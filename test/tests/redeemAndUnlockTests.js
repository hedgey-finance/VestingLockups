const C = require('../constants');
const { deploy } = require('../fixtures');
const { expect } = require('chai');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

const redeemUnlockTests = (params) => {
  let deployed, admin, a, b, c, d, token, vesting, batch, lock;
  let amount, recipient, vestingPlan, vestingStart, vestingCliff, vestingRate, vestingPeriod, vestingEnd, vestingAdmin;
  let lockPlan, lockStart, lockCliff, lockRate, lockPeriod, lockEnd;
  it('redeems a vesting lock plan that is redeemed over time by the recipient with unlock starting after vesting', async () => {
    deployed = await deploy(params.decimals);
    admin = deployed.admin;
    a = deployed.a;
    b = deployed.b;
    c = deployed.c;
    d = deployed.d;
    token = deployed.token;
    batch = deployed.batch;
    vesting = params.voting ? deployed.vvp : deployed.tvp;
    lock = params.voting ? deployed.votingLock : deployed.vestingLock;
    let now = BigInt(await time.latest());
    amount = params.amount;
    vestingStart = now + BigInt(params.start);
    vestingCliff = vestingStart + BigInt(params.cliff);
    vestingRate = C.getRate(amount, params.vestingPeriod, params.duration);
    vestingPeriod = BigInt(params.vestingPeriod);
    vestingEnd = C.planEnd(vestingStart, amount, vestingRate, vestingPeriod);
    vestingAdmin = admin.address;
    vestingPlan = {
      amount,
      start: vestingStart,
      cliff: vestingCliff,
      rate: vestingRate,
      period: vestingPeriod,
    };
    lockStart = vestingStart + BigInt(params.lockStart);
    lockCliff = vestingStart + BigInt(params.lockCliff);
    lockRate = C.getRate(amount, params.lockPeriod, params.lockDuration);
    lockPeriod = BigInt(params.lockPeriod);
    lockEnd = C.planEnd(lockStart, amount, lockRate, lockPeriod);

    lockPlan = {
      amount,
      start: lockStart,
      cliff: lockCliff,
      rate: lockRate,
      period: lockPeriod,
    };
    recipient = {
      beneficiary: a.address,
      adminRedeem: params.adminRedeem,
    };
    let tx = await batch.createVestingLockupPlans(
      lock.target,
      token.target,
      amount,
      [recipient],
      [vestingPlan],
      admin.address,
      false,
      [lockPlan],
      false,
      '1'
    );
    await time.increase((vestingEnd - vestingStart) / BigInt(2));
    now = BigInt(await time.latest()) + BigInt(1);
    let balanceCheck = await vesting.planBalanceOf(1, now, now);
    let remainder = balanceCheck.remainder;
    let balance = balanceCheck.balance;
    await lock.redeemVestingPlans([1]);
    expect(await token.balanceOf(lock.target)).to.eq(balance);
    expect(await token.balanceOf(vesting.target)).to.eq(remainder);
    let vestingPlanDetails = await vesting.plans(1);
    let lockPlanDetails = await lock.getVestingLock(1);
    expect(vestingPlanDetails.amount).to.eq(remainder);
    expect(lockPlanDetails.availableAmount).to.eq(balance);
    expect(lockPlanDetails.totalAmount).to.eq(amount);

    await time.increaseTo(vestingEnd);
    now = BigInt(await time.latest()) + BigInt(1);
    balanceCheck = await vesting.planBalanceOf(1, now, now);
    remainder = balanceCheck.remainder;
    balance = balanceCheck.balance;
    await lock.redeemVestingPlans([1]);
    expect(await token.balanceOf(lock.target)).to.eq(amount);
    expect(await token.balanceOf(vesting.target)).to.eq(0);
    lockPlanDetails = await lock.getVestingLock(1);
    expect(lockPlanDetails.availableAmount).to.eq(amount);
    expect(lockPlanDetails.totalAmount).to.eq(amount);
    await time.increaseTo(lockEnd);
    await lock.unlock([1]);
    expect(await token.balanceOf(a.address)).to.eq(amount);
    await token.connect(a).transfer(admin.address, amount);
  });
  it('redeems vesting lock plans to 4 recipients, and as the admin redeems them all over time', async () => {
    let now = BigInt(await time.latest());
    vestingStart = now + BigInt(params.start);
    vestingCliff = vestingStart + BigInt(params.cliff);
    vestingRate = C.getRate(amount, params.vestingPeriod, params.duration);
    vestingPeriod = BigInt(params.vestingPeriod);
    vestingEnd = C.planEnd(vestingStart, amount, vestingRate, vestingPeriod);
    vestingAdmin = admin.address;
    vestingPlan = {
      amount,
      start: vestingStart,
      cliff: vestingCliff,
      rate: vestingRate,
      period: vestingPeriod,
    };
    lockStart = vestingStart + BigInt(params.lockStart);
    lockCliff = vestingStart + BigInt(params.lockCliff);
    lockRate = C.getRate(amount, params.lockPeriod, params.lockDuration);
    lockPeriod = BigInt(params.lockPeriod);
    lockEnd = C.planEnd(lockStart, amount, lockRate, lockPeriod);

    lockPlan = {
      amount,
      start: lockStart,
      cliff: lockCliff,
      rate: lockRate,
      period: lockPeriod,
    };
    let numPlans = 4;
    let vestingPlans = new Array(numPlans).fill(vestingPlan);
    let lockPlans = new Array(numPlans).fill(lockPlan);
    let recipients = [
      {
        beneficiary: a.address,
        adminRedeem: true,
      },
      {
        beneficiary: b.address,
        adminRedeem: true,
      },
      {
        beneficiary: c.address,
        adminRedeem: true,
      },
      {
        beneficiary: d.address,
        adminRedeem: true,
      },
    ];
    let totalAmount = amount * BigInt(4);
    await batch.createVestingLockupPlans(
      lock.target,
      token.target,
      totalAmount,
      recipients,
      vestingPlans,
      vestingAdmin,
      false,
      lockPlans,
      false,
      '1'
    );
    await time.increase((vestingEnd - vestingStart) / BigInt(2));
    now = BigInt(await time.latest()) + BigInt(1);
    let balanceCheck = await vesting.planBalanceOf(2, now, now);
    let remainder = balanceCheck.remainder;
    let balance = balanceCheck.balance;
    await lock.redeemVestingPlans([2, 3, 4, 5]);
    expect(await token.balanceOf(lock.target)).to.eq(balance * BigInt(4));
    expect(await token.balanceOf(vesting.target)).to.eq(remainder * BigInt(4));
    await time.increaseTo(vestingEnd);
    await lock.redeemAndUnlock([2, 3, 4, 5]);
    await time.increaseTo(lockEnd);
    await lock.redeemAndUnlock([2, 3, 4, 5]);
    expect(await token.balanceOf(lock.target)).to.eq(0);
    expect(await token.balanceOf(vesting.target)).to.eq(0);
    expect(await token.balanceOf(a.address)).to.eq(amount);
    expect(await token.balanceOf(b.address)).to.eq(amount);
    expect(await token.balanceOf(c.address)).to.eq(amount);
    expect(await token.balanceOf(d.address)).to.eq(amount);
    await token.connect(a).transfer(admin.address, amount);
    await token.connect(b).transfer(admin.address, amount);
    await token.connect(c).transfer(admin.address, amount);
    await token.connect(d).transfer(admin.address, amount);
  });
  it('it redeems a vesting lock plan with a single unlock and redeems it before and after the unlock', async () => {
    let now = BigInt(await time.latest());
    vestingStart = now + BigInt(params.start);
    vestingCliff = vestingStart + BigInt(params.cliff);
    vestingRate = C.getRate(amount, params.vestingPeriod, params.duration);
    vestingPeriod = BigInt(params.vestingPeriod);
    vestingEnd = C.planEnd(vestingStart, amount, vestingRate, vestingPeriod);
    vestingAdmin = admin.address;
    vestingPlan = {
      amount,
      start: vestingStart,
      cliff: vestingCliff,
      rate: vestingRate,
      period: vestingPeriod,
    };
    lockStart = vestingStart + BigInt(params.lockStart);
    lockCliff = lockStart;
    lockRate = amount;
    lockPeriod = BigInt(1);
    lockEnd = lockStart + BigInt(1);
    lockPlan = {
      amount,
      start: lockStart,
      cliff: lockCliff,
      rate: lockRate,
      period: lockPeriod,
    };
    await batch.createVestingLockupPlans(
      lock.target,
      token.target,
      amount,
      [recipient],
      [vestingPlan],
      vestingAdmin,
      false,
      [lockPlan],
      false,
      '1'
    );
    await lock.connect(a).approveRedeemer(6, b.address);
    await time.increaseTo(lockStart - BigInt(10));
    now = BigInt(await time.latest()) + BigInt(1);
    let balanceCheck = await vesting.planBalanceOf(6, now, now);
    let remainder = balanceCheck.remainder;
    let balance = balanceCheck.balance;
    await lock.connect(a).redeemAndUnlock([6]);
    expect(await token.balanceOf(lock.target)).to.eq(balance);
    expect(await token.balanceOf(vesting.target)).to.eq(remainder);
    await time.increaseTo(lockEnd);
    now = BigInt(await time.latest()) + BigInt(1);
    let currentBalance = balance;
    balanceCheck = await vesting.planBalanceOf(6, now, now);
    balance = balanceCheck.balance;
    remainder = balanceCheck.remainder;
    await lock.connect(b).redeemAndUnlock([6]);
    expect(await token.balanceOf(lock.target)).to.eq(0);
    expect(await token.balanceOf(vesting.target)).to.eq(remainder);
    expect(await token.balanceOf(a.address)).to.eq(currentBalance + balance);
    let lockPlanDetails = await lock.getVestingLock(6);
    expect(lockPlanDetails.availableAmount).to.eq(0);
    expect(lockPlanDetails.totalAmount).to.eq(remainder);
    await time.increaseTo(vestingEnd);
    await lock.connect(b).redeemAndUnlock([6]);
    expect(await token.balanceOf(a.address)).to.eq(amount);
    await token.connect(a).transfer(admin.address, amount);
  });
  it('it redeems a vesting lock plan with the vesting and lock plan overlapping in time', async () => {
    let now = BigInt(await time.latest());
    vestingStart = now + BigInt(params.start);
    vestingCliff = vestingStart + BigInt(params.cliff);
    vestingRate = C.getRate(amount, params.vestingPeriod, params.duration);
    vestingPeriod = BigInt(params.vestingPeriod);
    vestingEnd = C.planEnd(vestingStart, amount, vestingRate, vestingPeriod);
    vestingAdmin = admin.address;
    vestingPlan = {
      amount,
      start: vestingStart,
      cliff: vestingCliff,
      rate: vestingRate,
      period: vestingPeriod,
    };
    lockPlan = {
      amount,
      start: vestingStart,
      cliff: vestingCliff,
      rate: vestingRate,
      period: vestingPeriod,
    };
    recipient = {
      beneficiary: c.address,
      adminRedeem: true,
    };
    await batch.createVestingLockupPlans(
      lock.target,
      token.target,
      amount,
      [recipient],
      [vestingPlan],
      vestingAdmin,
      false,
      [lockPlan],
      false,
      '1'
    );
    await time.increase((vestingEnd - vestingStart) / BigInt(2));
    now = BigInt(await time.latest()) + BigInt(1);
    let balanceCheck = await vesting.planBalanceOf(7, now, now);
    let remainder = balanceCheck.remainder;
    let balance = balanceCheck.balance;
    await lock.redeemAndUnlock([7]);
    expect(await token.balanceOf(lock.target)).to.eq(0);
    expect(await token.balanceOf(vesting.target)).to.eq(remainder);
    expect(await token.balanceOf(c.address)).to.eq(balance);
    await time.increaseTo(vestingEnd);
    await lock.redeemAndUnlock([7]);
    expect(await token.balanceOf(lock.target)).to.eq(0);
    expect(await token.balanceOf(vesting.target)).to.eq(0);
    expect(await token.balanceOf(c.address)).to.eq(amount);
    await token.connect(c).transfer(admin.address, amount);
  });
  it('it redeems a vesting lock plan whith a streaming vesting plan and a periodic lock plan', async () => {
    let now = BigInt(await time.latest());
    vestingStart = now;
    vestingCliff = vestingStart + BigInt(params.cliff);
    vestingPeriod = BigInt(1);
    vestingRate = C.getRate(amount, vestingPeriod, params.duration);
    vestingEnd = C.planEnd(vestingStart, amount, vestingRate, vestingPeriod);
    vestingAdmin = admin.address;
    vestingPlan = {
      amount,
      start: vestingStart,
      cliff: vestingCliff,
      rate: vestingRate,
      period: vestingPeriod,
    };
    lockPeriod = C.WEEK;
    lockRate = C.getRate(amount, lockPeriod, params.duration * BigInt(2));
    lockEnd = C.planEnd(vestingStart, amount, lockRate, lockPeriod);
    lockPlan = {
      amount,
      start: vestingStart,
      cliff: vestingCliff,
      rate: lockRate,
      period: lockPeriod,
    };
    recipient = {
      beneficiary: c.address,
      adminRedeem: true,
    };
    await batch.createVestingLockupPlans(
      lock.target,
      token.target,
      amount,
      [recipient],
      [vestingPlan],
      vestingAdmin,
      false,
      [lockPlan],
      false,
      '1'
    );
    await time.increaseTo(C.bigMax(vestingCliff, vestingStart + C.DAY));
    now = BigInt(await time.latest()) + BigInt(1);
    let balanceCheck = await vesting.planBalanceOf(8, now, now);
    let remainder = balanceCheck.remainder;
    let balance = balanceCheck.balance;
    await lock.redeemVestingPlans([8]);
    let lockCheck = await lock.getLockBalance(8);
    let unlockedBalance = lockCheck.unlockedBalance;
    let lockedBalance = lockCheck.lockedBalance;
    let unlockTime = lockCheck.unlockTime;
    await lock.unlock([8]);
    if (unlockedBalance == BigInt(0)) {
      // only vesting has been pulled in
      expect(await token.balanceOf(lock.target)).to.eq(balance);
      expect(await token.balanceOf(lock.target)).to.eq(lockedBalance);
      expect(await token.balanceOf(c.address)).to.eq(0);
      let lockPlanDetails = await lock.getVestingLock(8);
      expect(lockPlanDetails.availableAmount).to.eq(balance);
      expect(lockPlanDetails.totalAmount).to.eq(amount);
    } else {
      // need to check that it pulls the min of total vesting and total unlocked
      expect(await token.balanceOf(a.address)).to.eq(unlockedBalance);
      expect(await token.balanceOf(lock.target)).to.eq(lockedBalance);
      expect(await token.balanceOf(lock.target)).to.eq(balance - unlockedBalance);
    }
    await time.increase(C.WEEK);
    now = BigInt(await time.latest()) + BigInt(1);
    let currentBalance = balance;
    balanceCheck = await vesting.planBalanceOf(8, now, now);
    balance = balanceCheck.balance;
    remainder = balanceCheck.remainder;
    await lock.redeemVestingPlans([8]);
    let previousUnlockeBalance = unlockedBalance;
    let lockCheck2 = await lock.getLockBalance(8);
    unlockedBalance = lockCheck2.unlockedBalance;
    lockedBalance = lockCheck2.lockedBalance;
    unlockTime = lockCheck2.unlockTime;
    await lock.unlock([8]);
    expect(await token.balanceOf(lock.target)).to.eq(currentBalance + balance - unlockedBalance);
    expect(await token.balanceOf(c.address)).to.eq(unlockedBalance + previousUnlockeBalance);
    expect(await token.balanceOf(lock.target)).to.eq(lockedBalance);
    expect(await token.balanceOf(vesting.target)).to.eq(remainder);
    let lockPlanDetails = await lock.getVestingLock(8);
    expect(lockPlanDetails.availableAmount).to.eq(currentBalance + balance - unlockedBalance);
    expect(lockPlanDetails.totalAmount).to.eq(amount - unlockedBalance);
    await time.increase(C.WEEK + C.DAY + C.DAY);
    // test that the unlock time is the week ago time slot
    now = BigInt(await time.latest()) + BigInt(1);
    balanceCheck = await vesting.planBalanceOf(8, now, now);
    balance = balanceCheck.balance;
    remainder = balanceCheck.remainder;
    await lock.redeemAndUnlock([8]);
    expect(await token.balanceOf(lock.target)).to.eq(lockedBalance + balance - lockRate);
    expect(await token.balanceOf(c.address)).to.eq(unlockedBalance + previousUnlockeBalance + lockRate);
    await time.increaseTo(lockEnd);
    await lock.redeemAndUnlock([8]);
    expect(await token.balanceOf(c.address)).to.eq(amount);
    await token.connect(c).transfer(admin.address, amount);
  });
  it('it redeems a vesting lock plan with a periodic vesting plan and a streaming lock plan', async () => {
    let now = BigInt(await time.latest());
    vestingStart = now;
    vestingCliff = vestingStart + BigInt(params.cliff);
    vestingPeriod = C.WEEK;
    vestingRate = C.getRate(amount, vestingPeriod, C.MONTH);
    vestingEnd = C.planEnd(vestingStart, amount, vestingRate, vestingPeriod);
    vestingAdmin = admin.address;
    vestingPlan = {
      amount,
      start: vestingStart,
      cliff: vestingCliff,
      rate: vestingRate,
      period: vestingPeriod,
    };
    lockPeriod = BigInt(1);
    lockRate = C.getRate(amount, lockPeriod, C.MONTH);
    lockStart = params.lockStart = vestingCliff + vestingPeriod;
    lockEnd = C.planEnd(lockStart, amount, lockRate, lockPeriod);
    lockPlan = {
      amount,
      start: lockStart,
      cliff: lockStart,
      rate: lockRate,
      period: lockPeriod,
    };
    recipient = {
      beneficiary: c.address,
      adminRedeem: true,
    };
    await batch.createVestingLockupPlans(
      lock.target,
      token.target,
      amount,
      [recipient],
      [vestingPlan],
      vestingAdmin,
      false,
      [lockPlan],
      false,
      '1'
    );
    await time.increase(vestingCliff + C.WEEK);
    now = BigInt(await time.latest()) + BigInt(1);
    let balanceCheck = await vesting.planBalanceOf(9, now, now);
    let remainder = balanceCheck.remainder;
    let balance = balanceCheck.balance;
    await lock.redeemVestingPlans([9]);
    expect(await token.balanceOf(lock.target)).to.eq(balance);
    expect(await token.balanceOf(vesting.target)).to.eq(remainder);
    expect(await token.balanceOf(c.address)).to.eq(0);
    let lockBalance = await lock.getLockBalance(9);
    let unlockedBalance = lockBalance.unlockedBalance;
    let lockedBalance = lockBalance.lockedBalance;
    await lock.unlock([9]);
    expect(await token.balanceOf(lock.target)).to.eq(lockedBalance);
    expect(await token.balanceOf(c.address)).to.eq(unlockedBalance);
  });
};

const redeemUnlockErrorTests = (params) => {
  let deployed, admin, a, b, c, d, token, nvt, vesting, batch, lock;
  let amount, recipient, vestingPlan, vestingStart, vestingCliff, vestingRate, vestingPeriod, vestingEnd, vestingAdmin;
  let lockPlan, lockStart, lockCliff, lockRate, lockPeriod, lockEnd;
  it('should revert if the redeemer is not approved to redeem or unlock', async () => {
    deployed = await deploy(params.decimals);
    admin = deployed.admin;
    a = deployed.a;
    b = deployed.b;
    c = deployed.c;
    d = deployed.d;
    token = deployed.token;
    batch = deployed.batch;
    vesting = params.voting ? deployed.vvp : deployed.tvp;
    lock = params.voting ? deployed.votingLock : deployed.vestingLock;
    let now = BigInt(await time.latest());
    amount = params.amount;
    vestingStart = now + BigInt(params.start);
    vestingCliff = vestingStart + BigInt(params.cliff);
    vestingRate = C.getRate(amount, params.vestingPeriod, params.duration);
    vestingPeriod = BigInt(params.vestingPeriod);
    vestingEnd = C.planEnd(vestingStart, amount, vestingRate, vestingPeriod);
    vestingAdmin = admin.address;
    vestingPlan = {
      amount,
      start: vestingStart,
      cliff: vestingCliff,
      rate: vestingRate,
      period: vestingPeriod,
    };
    lockStart = vestingStart + BigInt(params.lockStart);
    lockCliff = vestingStart + BigInt(params.lockCliff);
    lockRate = C.getRate(amount, params.lockPeriod, params.lockDuration);
    lockPeriod = BigInt(params.lockPeriod);
    lockEnd = C.planEnd(lockStart, amount, lockRate, lockPeriod);

    lockPlan = {
      amount,
      start: lockStart,
      cliff: lockCliff,
      rate: lockRate,
      period: lockPeriod,
    };
    recipient = {
      beneficiary: a.address,
      adminRedeem: false,
    };
    await batch.createVestingLockupPlans(
      lock.target,
      token.target,
      amount,
      [recipient],
      [vestingPlan],
      admin.address,
      false,
      [lockPlan],
      false,
      '1'
    );
    await time.increaseTo(vestingEnd);
    await expect(lock.redeemAndUnlock([1])).to.be.revertedWith('!approved');
    await expect(lock.redeemVestingPlans([1])).to.be.revertedWith('!approved');
    await expect(lock.unlock([1])).to.be.revertedWith('!approved');
  });
  it('should revert if the redeeming plan does not exist', async () => {
    await expect(lock.redeemAndUnlock([2])).to.be.reverted;
    await expect(lock.redeemVestingPlans([2])).to.be.reverted;
    await expect(lock.unlock([2])).to.be.reverted;
  });
};

module.exports = {
  redeemUnlockTests,
  redeemUnlockErrorTests,
};
