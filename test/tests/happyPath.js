const C = require('../constants');
const { deploy } = require('../fixtures');
const { expect } = require('chai');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

module.exports = () => {
  let deployed,
    admin,
    a,
    b,
    c,
    d,
    token,
    nvt,
    vesting,
    voteVesting,
    batch,
    votingLock,
    vestingLock,
    vestingPlan,
    lockPlan,
    recipientA,
    recipientB;
  let amount, vestingStart, vestingCliff, vestingRate, vestingPeriod, vestingEnd, vestingAdmin;
  let lockStart, lockCliff, lockRate, lockPeriod, lockEnd;
  it('deploys the contract and dao creates a single vesting lock plan, then recipient redeems and unlocks it over time', async () => {
    deployed = await deploy(18);
    admin = deployed.admin;
    a = deployed.a;
    b = deployed.b;
    c = deployed.c;
    d = deployed.d;
    token = deployed.token;
    nvt = deployed.nvt;
    batch = deployed.batch;
    voteVesting = deployed.vvp;
    vesting = deployed.tvp;
    votingLock = deployed.votingLock;
    vestingLock = deployed.vestingLock;
    let now = BigInt(await time.latest());
    amount = C.E18_10000;
    vestingStart = now;
    vestingCliff = now + C.MONTH;
    vestingPeriod = BigInt(1);
    vestingRate = C.getRate(amount, vestingPeriod, C.MONTH * BigInt(6));
    vestingEnd = C.planEnd(vestingStart, amount, vestingRate, vestingPeriod);
    vestingAdmin = admin.address;
    vestingPlan = {
      amount,
      start: vestingStart,
      cliff: vestingCliff,
      rate: vestingRate,
      period: vestingPeriod,
    };
    lockStart = now + BigInt(C.MONTH * BigInt(3));
    lockCliff = lockStart;
    lockPeriod = BigInt(1);
    lockRate = C.getRate(amount, lockPeriod, C.YEAR);
    lockEnd = C.planEnd(lockStart, amount, lockRate, lockPeriod);
    lockPlan = {
      amount,
      start: lockStart,
      cliff: lockCliff,
      rate: lockRate,
      period: lockPeriod,
    };
    recipientA = {
      beneficiary: a.address,
      adminRedeem: false,
    };
    recipientB = {
      beneficiary: b.address,
      adminRedeem: true,
    };
    await batch.createVestingLockupPlans(
      votingLock.target,
      token.target,
      [recipientA],
      [vestingPlan],
      vestingAdmin,
      false,
      [lockPlan],
      false,
      amount,
      1
    );
    await batch.createVestingLockupPlans(
      vestingLock.target,
      token.target,
      [recipientB],
      [vestingPlan],
      vestingAdmin,
      false,
      [lockPlan],
      false,
      amount,
      1
    );
    // move forward in time three weeks before vesting cliff - check that nothing gets redeemed
    await time.increase(C.WEEK * BigInt(3));
    let txA = await votingLock.connect(a).redeemAndUnlock([1]);
    expect(await token.balanceOf(a.address)).to.equal(0);
    let txB = await vestingLock.redeemAndUnlock([1]);
    expect(await token.balanceOf(b.address)).to.equal(0);
    expect(await token.balanceOf(vestingLock.target)).to.equal(0);
    expect(await token.balanceOf(votingLock.target)).to.equal(0);
    // move forward in time to vesting cliff - check that tokens are redeemed from vesting but not unlocked
    await time.increaseTo(vestingCliff);
    now = BigInt(await time.latest()) + BigInt(1);
    let balanceCheckA = await voteVesting.planBalanceOf(1, now, now);
    let remainderA = balanceCheckA.remainder;
    let balanceA = balanceCheckA.balance;
    txA = await votingLock.connect(a).redeemAndUnlock([1]);
    expect(await token.balanceOf(a.address)).to.equal(0);
    expect(await token.balanceOf(votingLock.target)).to.equal(balanceA);
    expect(await token.balanceOf(voteVesting.target)).to.equal(remainderA);
    expect((await votingLock.getVestingLock(1)).availableAmount).to.equal(balanceA);
    expect((await votingLock.getVestingLock(1)).totalAmount).to.equal(amount);

    now = BigInt(await time.latest()) + BigInt(1);
    let balanceCheckB = await vesting.planBalanceOf(1, now, now);
    let remainderB = balanceCheckB.remainder;
    let balanceB = balanceCheckB.balance;
    txB = await vestingLock.redeemAndUnlock([1]);
    expect(await token.balanceOf(b.address)).to.equal(0);
    expect(await token.balanceOf(vestingLock.target)).to.equal(balanceB);
    expect(await token.balanceOf(vesting.target)).to.equal(remainderB);
    expect((await vestingLock.getVestingLock(1)).availableAmount).to.equal(balanceB);
    expect((await vestingLock.getVestingLock(1)).totalAmount).to.equal(amount);

    await time.increaseTo(lockCliff + C.MONTH);
    now = BigInt(await time.latest()) + BigInt(1);
    let amountUnlocked = (now - lockCliff) * lockRate;
    await votingLock.connect(a).unlock([1]);
    await vestingLock.unlock([1]);
    expect(await token.balanceOf(a.address)).to.equal(amountUnlocked);
    expect(await token.balanceOf(b.address)).to.equal(amountUnlocked + lockRate);
    expect((await votingLock.getVestingLock(1)).availableAmount).to.equal(balanceA - amountUnlocked);
    expect((await votingLock.getVestingLock(1)).totalAmount).to.equal(amount - amountUnlocked);
    expect((await vestingLock.getVestingLock(1)).availableAmount).to.equal(balanceB - (amountUnlocked + lockRate));
    expect((await vestingLock.getVestingLock(1)).totalAmount).to.equal(amount - (amountUnlocked + lockRate));

    await time.increaseTo(lockEnd);
    await votingLock.connect(a).redeemAndUnlock([1]);
    await vestingLock.redeemAndUnlock([1]);
    expect(await token.balanceOf(a.address)).to.equal(amount);
    expect(await token.balanceOf(b.address)).to.equal(amount);
  });
  it('dao creates an additional vesting lock plans with delegation, and unlocks over time', async () => {
    await token.connect(a).transfer(admin.address, amount);
    let now = BigInt(await time.latest());
    vestingStart = now;
    vestingCliff = now + C.MONTH;
    vestingPeriod = BigInt(1);
    vestingRate = C.getRate(amount, vestingPeriod, C.MONTH * BigInt(6));
    vestingEnd = C.planEnd(vestingStart, amount, vestingRate, vestingPeriod);
    lockStart = now + BigInt(C.MONTH * BigInt(3));
    lockCliff = lockStart;
    lockPeriod = BigInt(1);
    lockRate = C.getRate(amount, lockPeriod, C.YEAR);
    lockEnd = C.planEnd(lockStart, amount, lockRate, lockPeriod);
    vestingPlan = {
      amount,
      start: vestingStart,
      cliff: vestingCliff,
      rate: vestingRate,
      period: vestingPeriod,
    };
    lockPlan = {
      amount,
      start: lockStart,
      cliff: lockCliff,
      rate: lockRate,
      period: lockPeriod,
    };
    await batch.createVestingLockupPlansWithDelegation(
      votingLock.target,
      token.target,
      [recipientA],
      [a.address],
      [vestingPlan],
      vestingAdmin,
      false,
      [lockPlan],
      false,
      amount,
      1
    );
    let vestingVotingVault = await voteVesting.votingVaults(2);
    expect(await token.balanceOf(vestingVotingVault)).to.equal(amount);
    expect(await token.delegates(vestingVotingVault)).to.equal(a.address);

    await votingLock.connect(a).delegate(2, c.address);
    let lockVotingVault = await votingLock.votingVaults(2);
    expect(await token.balanceOf(lockVotingVault)).to.equal(0);
    expect(await token.delegates(lockVotingVault)).to.equal(c.address);

    await time.increaseTo(vestingCliff);
    now = BigInt(await time.latest()) + BigInt(1);
    let balanceCheckA = await voteVesting.planBalanceOf(2, now, now);
    let remainderA = balanceCheckA.remainder;
    let balanceA = balanceCheckA.balance;
    await votingLock.connect(a).redeemVestingPlans([2]);
    expect(await token.balanceOf(vestingVotingVault)).to.eq(remainderA);
    expect(await token.balanceOf(lockVotingVault)).to.eq(balanceA);

    await time.increaseTo(lockCliff + C.MONTH);
    now = BigInt(await time.latest()) + BigInt(1);
    let newBalanceCheck = await voteVesting.planBalanceOf(2, now, now);
    let newBalanceA = newBalanceCheck.balance;
    let newRemainderA = newBalanceCheck.remainder;
    let unlockedAmount = (now - lockCliff) * lockRate;
    // when we call redeemAndUnlock it should transfer the balance from voting vault of vesting to voting vault of the lock, then transfer the unlocked amount from the lock vault to a.address
    await votingLock.connect(a).redeemAndUnlock([2]);
    expect(await token.balanceOf(lockVotingVault)).to.eq(balanceA + newBalanceA - unlockedAmount);
    expect((await votingLock.getVestingLock(2)).availableAmount).to.eq(balanceA + newBalanceA - unlockedAmount);
    expect((await votingLock.getVestingLock(2)).totalAmount).to.eq(
      balanceA + newBalanceA - unlockedAmount + newRemainderA
    );
    expect(await token.balanceOf(vestingVotingVault)).to.eq(newRemainderA);
    expect(await token.balanceOf(a.address)).to.eq(unlockedAmount);

    await time.increaseTo(lockEnd);
    await votingLock.connect(a).redeemAndUnlock([2]);
    expect(await token.balanceOf(a.address)).to.eq(amount);
    expect(await token.balanceOf(lockVotingVault)).to.eq(0);
    expect(await token.balanceOf(vestingVotingVault)).to.eq(0);
  });
  it('dao creates a streaming vesting plan with a single unlock date with admin approval', async () => {
    await token.connect(a).transfer(admin.address, amount);
    let now = BigInt(await time.latest());
    recipientA.adminRedeem = true;
    vestingStart = now;
    vestingCliff = now + C.MONTH;
    vestingPeriod = BigInt(1);
    vestingRate = C.getRate(amount, vestingPeriod, C.MONTH * BigInt(6));
    vestingEnd = C.planEnd(vestingStart, amount, vestingRate, vestingPeriod);
    lockStart = now + BigInt(C.MONTH * BigInt(2));
    lockCliff = lockStart;
    lockPeriod = BigInt(1);
    lockRate = amount;
    lockEnd = C.planEnd(lockStart, amount, lockRate, lockPeriod);
    vestingPlan = {
      amount,
      start: vestingStart,
      cliff: vestingCliff,
      rate: vestingRate,
      period: vestingPeriod,
    };
    lockPlan = {
      amount,
      start: lockStart,
      cliff: lockCliff,
      rate: lockRate,
      period: lockPeriod,
    };
    await batch.createVestingLockupPlansWithDelegation(
      votingLock.target,
      token.target,
      [recipientA],
      [a.address],
      [vestingPlan],
      vestingAdmin,
      false,
      [lockPlan],
      false,
      amount,
      1
    );
    let vestingVotingVault = await voteVesting.votingVaults(3);
    await time.increaseTo(vestingCliff);
    now = BigInt(await time.latest()) + BigInt(1);
    let balanceCheckA = await voteVesting.planBalanceOf(3, now, now);
    let remainderA = balanceCheckA.remainder;
    let balanceA = balanceCheckA.balance;
    await votingLock.redeemAndUnlock([3]);
    expect(await token.balanceOf(a.address)).to.eq(0);
    expect(await token.balanceOf(vestingVotingVault)).to.eq(remainderA);
    expect(await token.balanceOf(votingLock.target)).to.eq(balanceA);

    await time.increaseTo(lockCliff);
    now = BigInt(await time.latest()) + BigInt(1);
    let newBalanceCheck = await voteVesting.planBalanceOf(3, now, now);
    let newBalanceA = newBalanceCheck.balance;
    let newRemainderA = newBalanceCheck.remainder;
    await votingLock.redeemAndUnlock([3]);
    // should redeem balanceA from before and newBalanceA
    let redeemAmount = balanceA + newBalanceA;
    expect(await token.balanceOf(a.address)).to.eq(redeemAmount);
    expect(await token.balanceOf(vestingVotingVault)).to.eq(newRemainderA);

    await time.increase(C.MONTH);
    now = BigInt(await time.latest()) + BigInt(1);
    balanceCheckA = await voteVesting.planBalanceOf(3, now, now);
    remainderA = balanceCheckA.remainder;
    balanceA = balanceCheckA.balance;
    redeemAmount += balanceA;
    await votingLock.redeemAndUnlock([3]);
    expect(await token.balanceOf(a.address)).to.eq(redeemAmount);
    expect(await token.balanceOf(votingLock.target)).to.eq(0);
    expect(await token.balanceOf(vestingVotingVault)).to.eq(remainderA);

    await time.increaseTo(vestingEnd);
    await votingLock.redeemAndUnlock([3]);
    expect(await token.balanceOf(a.address)).to.eq(amount);
    expect(await token.balanceOf(votingLock.target)).to.eq(0);
    expect(await token.balanceOf(vestingVotingVault)).to.eq(0);
  });
  it('dao creates a monthly vesting plan with a single unlock date with admin approval', async () => {
    await token.connect(a).transfer(admin.address, amount);
    let now = BigInt(await time.latest());
    recipientA.adminRedeem = true;
    vestingStart = now;
    vestingCliff = now + C.MONTH;
    vestingPeriod = C.MONTH;
    vestingRate = C.getRate(amount, vestingPeriod, C.MONTH * BigInt(6));
    vestingEnd = C.planEnd(vestingStart, amount, vestingRate, vestingPeriod);
    lockStart = now + BigInt(C.MONTH * BigInt(2));
    lockCliff = lockStart;
    lockPeriod = BigInt(1);
    lockRate = amount;
    lockEnd = C.planEnd(lockStart, amount, lockRate, lockPeriod);
    vestingPlan = {
      amount,
      start: vestingStart,
      cliff: vestingCliff,
      rate: vestingRate,
      period: vestingPeriod,
    };
    lockPlan = {
      amount,
      start: lockStart,
      cliff: lockCliff,
      rate: lockRate,
      period: lockPeriod,
    };
    await batch.createVestingLockupPlansWithDelegation(
      votingLock.target,
      token.target,
      [recipientA],
      [a.address],
      [vestingPlan],
      vestingAdmin,
      false,
      [lockPlan],
      false,
      amount,
      1
    );
    let vestingVotingVault = await voteVesting.votingVaults(4);
    await time.increaseTo(vestingCliff);
    now = BigInt(await time.latest()) + BigInt(1);
    let balanceCheckA = await voteVesting.planBalanceOf(4, now, now);
    let remainderA = balanceCheckA.remainder;
    let balanceA = balanceCheckA.balance;
    await votingLock.redeemAndUnlock([4]);
    expect(await token.balanceOf(a.address)).to.eq(0);
    expect(await token.balanceOf(vestingVotingVault)).to.eq(remainderA);
    expect(await token.balanceOf(votingLock.target)).to.eq(balanceA);

    await time.increaseTo(lockCliff);
    now = BigInt(await time.latest()) + BigInt(1);
    let newBalanceCheck = await voteVesting.planBalanceOf(4, now, now);
    let newBalanceA = newBalanceCheck.balance;
    let newRemainderA = newBalanceCheck.remainder;
    await votingLock.redeemAndUnlock([4]);
    // should redeem balanceA from before and newBalanceA
    let redeemAmount = balanceA + newBalanceA;
    expect(await token.balanceOf(a.address)).to.eq(redeemAmount);
    expect(await token.balanceOf(vestingVotingVault)).to.eq(newRemainderA);

    await time.increase(C.MONTH);
    now = BigInt(await time.latest()) + BigInt(1);
    balanceCheckA = await voteVesting.planBalanceOf(4, now, now);
    remainderA = balanceCheckA.remainder;
    balanceA = balanceCheckA.balance;
    redeemAmount += balanceA;
    await votingLock.redeemAndUnlock([4]);
    expect(await token.balanceOf(a.address)).to.eq(redeemAmount);
    expect(await token.balanceOf(votingLock.target)).to.eq(0);
    expect(await token.balanceOf(vestingVotingVault)).to.eq(remainderA);

    await time.increaseTo(vestingEnd);
    await votingLock.redeemAndUnlock([4]);
    expect(await token.balanceOf(a.address)).to.eq(amount);
    expect(await token.balanceOf(votingLock.target)).to.eq(0);
    expect(await token.balanceOf(vestingVotingVault)).to.eq(0);
  });
};
