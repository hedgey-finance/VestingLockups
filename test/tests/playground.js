const C = require('../constants');
const { deploy } = require('../fixtures');
const setup = require('../fixtures');
const { expect } = require('chai');
const { time } = require('@nomicfoundation/hardhat-network-helpers');
const { ethers } = require('hardhat');

const playground = () => {
  let deployed, admin, a, b, c, d, token, nvt, vesting, lockup, batch;
  it('tests for a streaming vesting plan unlocked by a periodic lockup plan for 10k tokens', async () => {
    deployed = await deploy(18);
    admin = deployed.admin;
    a = deployed.a;
    b = deployed.b;
    c = deployed.c;
    d = deployed.d;
    token = deployed.token;
    nvt = deployed.nvt;
    batch = deployed.batch;
    vesting = deployed.vvp;
    lockup = deployed.votingLock;
    let now = BigInt(await time.latest());
    let amount = C.E18_10000;
    let recipient = {
      beneficiary: a.address,
      adminRedeem: true,
    };
    let vestingPlan = {
      amount,
      start: now,
      cliff: now,
      rate: amount / C.YEAR,
      period: BigInt(1),
    };
    console.log(`vesting rate: ${vestingPlan.rate}`);

    let lockPlan = {
      amount,
      start: now,
      cliff: now,
      rate: amount / BigInt(53), // 53 weeks lockup
      period: C.WEEK,
    };
    console.log(`lockup rate: ${lockPlan.rate}`);
    let tx = await batch.createVestingLockupPlans(
      lockup.target,
      token.target,
      amount,
      [recipient],
      [vestingPlan],
      admin.address,
      true,
      [lockPlan],
      true,
      1
    );
    let lockPlan1 = await lockup.getVestingLock('1');
    console.log(`original start date: ${lockPlan1.start}`);
    // want to test unlocking enough tokens on the vesting plan to cover 1 week, but redeeming at the 2 week break point
    await time.increase(C.WEEK);
    await lockup.connect(a).redeemVestingPlans(['1']);
    console.log(`balance of contract is: ${await token.balanceOf(lockup.target)}`);
    expect(await token.balanceOf(lockup.target)).to.be.lessThan(lockPlan.rate * BigInt(2));
    await time.increase(C.WEEK);
    let unlockTx = await lockup.connect(a).unlock(['1']);
    expect(unlockTx).to.emit(token, 'Transfer').withArgs(lockup.target, a.address, lockPlan.rate);
    expect(await token.balanceOf(a.address)).to.eq(lockPlan.rate);
    lockPlan1 = await lockup.getVestingLock('1');
    console.log(`new start date reset to: ${lockPlan1.start}`);
    console.log(`original start plus 1 period: ${lockPlan.start + lockPlan.period}`);
    console.log(`current remaining token balance is: ${await token.balanceOf(lockup.target)}`);
    console.log(`current time: ${await time.latest()}`);
    // test now callig redeemAndUnlock now - which should redeem more and unlock the next period to reset to current time
    unlockTx = await lockup.connect(a).redeemAndUnlock(['1']);
    expect(unlockTx).to.emit(token, 'Transfer').withArgs(lockup.target, a.address, lockPlan.rate);
    lockPlan1 = await lockup.getVestingLock('1');
    console.log(`updated start date is now: ${lockPlan1.start}`);
    expect(lockPlan1.start).to.eq(lockPlan.start + lockPlan.period + lockPlan.period);
    // need to test the end for when the available amount == total amount and is less than a single period
    await time.increaseTo(await vesting.planEnd('1'));
    now = BigInt(await time.latest());
    console.log(`new time: ${now}`);
    console.log(`number of weeks passed: ${(now - lockPlan.start) / lockPlan.period}`);
    await lockup.connect(a).redeemAndUnlock(['1']);
    //should have redeemed the entire balance, and unlocked all 52 of 53 weeks, should be one weeks worth remaining
    let remainder = await token.balanceOf(lockup.target);
    console.log(`remainder tokens for final week: ${remainder}`);
    console.log(`difference of remainder vs rate: ${lockPlan.rate - remainder}`);
    // expect(lockPlan.rate).to.be.greaterThan(remainder);
    lockPlan1 = await lockup.getVestingLock('1');
    console.log(`difference of total and available: ${lockPlan1.totalAmount - lockPlan1.availableAmount}`);
    console.log(`vesting plan: ${await vesting.plans('1')}`);
    // expect(lockPlan1.totalAmount).to.eq(lockPlan1.availableAmount);
    await lockup.redeemAndUnlock(['1']);
    await time.increase(C.WEEK);
    await lockup.redeemAndUnlock(['1']);
    console.log(`stub balance: ${await token.balanceOf(lockup.target)}`);
    //redeems final stub
    await time.increaseTo(await lockup.getLockEnd('1'));
    await lockup.redeemAndUnlock(['1']);
    console.log(`final balance: ${await token.balanceOf(lockup.target)}`);
  });
  it('tests for a monthly vesting plan unlocked by a streaming lockup plan', async () => {
    let now = BigInt(await time.latest());
    let amount = C.E18_10000;
    let recipient = {
      beneficiary: a.address,
      adminRedeem: true,
    };
    let vestingPlan = {
      amount,
      start: now,
      cliff: now,
      rate: amount / BigInt(12),
      period: C.MONTH,
    };
    console.log(`vesting rate: ${vestingPlan.rate}`);

    let lockPlan = {
      amount,
      start: now,
      cliff: now,
      rate: amount / (C.YEAR + C.YEAR), //2 years
      period: BigInt(1),
    };
    console.log(`lockup rate: ${lockPlan.rate}`);
    let tx = await batch.createVestingLockupPlans(
      lockup.target,
      token.target,
      amount,
      [recipient],
      [vestingPlan],
      admin.address,
      true,
      [lockPlan],
      true,
      1
    );
    let lockPlan2 = await lockup.getVestingLock('2');
    console.log(`original start date: ${lockPlan2.start}`);
    //check unlocking in 1 month
    tx = await lockup.connect(a).redeemAndUnlock(['2']);
    await time.increase(C.MONTH);
    tx = await lockup.connect(a).redeemAndUnlock(['2']);
  });
  it('tests redeeming in the second to last period and then unlocking the final period to see if it will break and push out the end date', async () => {
    let now = BigInt(await time.latest());
    let amount = C.E18_10000;
    let recipient = {
      beneficiary: d.address,
      adminRedeem: true,
    };
    let vestingPlan = {
      amount,
      start: now,
      cliff: now,
      rate: amount / BigInt(10),
      period: C.MONTH,
    };

    let lockPlan = {
      amount,
      start: now,
      cliff: now,
      rate: amount / BigInt(10),
      period: C.MONTH,
    };
    let tx = await batch.createVestingLockupPlans(
      lockup.target,
      token.target,
      amount,
      [recipient],
      [vestingPlan],
      admin.address,
      true,
      [lockPlan],
      true,
      1
    );
    // move forward in time to 9th month and redeem only
    let initalBalanceOfLock = await token.balanceOf(lockup.target);
    let initialBalanceOfD = await token.balanceOf(d.address);
    await time.increase(C.MONTH * BigInt(9));
    await lockup.connect(d).redeemVestingPlans(['3']);
    expect(await token.balanceOf(d.address)).to.eq(initialBalanceOfD);
    expect(await token.balanceOf(lockup.target)).to.eq(initalBalanceOfLock + vestingPlan.rate * BigInt(9));
    await time.increase(C.MONTH);
    // at the end - just call unlock function now
    await lockup.connect(d).unlock(['3']);
    // should unlock just what has been redeemed
    expect(await token.balanceOf(d.address)).to.eq(initialBalanceOfD + vestingPlan.rate * BigInt(9));
    expect(await token.balanceOf(lockup.target)).to.eq(initalBalanceOfLock);
    let lockupPlan = await lockup.getVestingLock('3');
    // start date should be set to month prior since only 11 months have been unlocked
    console.log(`start date: ${lockupPlan.start}`);
    console.log('11 months later: ', lockupPlan.start + lockupPlan.period * BigInt(9));
    // expect(lockupPlan.start).to.eq(lockupPlan.start + (lockupPlan.period * BigInt(11)));
    // should now be able to call redeemAndUnlock and pull remainning tokens
    await lockup.connect(d).redeemAndUnlock(['3']);
    expect(await token.balanceOf(d.address)).to.eq(initialBalanceOfD + amount);
    expect(await token.balanceOf(lockup.target)).to.eq(initalBalanceOfLock);
  });
  it('tests when the vesting plan is transferred out and the available balance is less than the rate but total amount is more - using redeemVesting to trigger the contract to update the total to only the available', async () => {
    let now = BigInt(await time.latest());
    let amount = C.E18_10000;
    let recipient = {
      beneficiary: b.address,
      adminRedeem: true,
    };
    let vestingPlan = {
      amount,
      start: now,
      cliff: now,
      rate: amount / BigInt(20),
      period: C.WEEK,
    };

    let lockPlan = {
      amount,
      start: now,
      cliff: now,
      rate: amount / BigInt(10),
      period: C.MONTH,
    };
    let tx = await batch.createVestingLockupPlans(
      lockup.target,
      token.target,
      amount,
      [recipient],
      [vestingPlan],
      admin.address,
      true,
      [lockPlan],
      true,
      1
    );
    // move forward 1 week and redeem just vesting
    await time.increase(C.WEEK);
    await lockup.connect(b).redeemVestingPlans(['4']);
    await lockup.connect(b).updateVestingTransferability('4', true);
    await vesting.connect(admin).transferFrom(lockup.target, a.address, '4');
    // expect that nothing can be unlocked even after 1 month
    let lockupDetails = await lockup.getVestingLock('4');
    expect(lockupDetails.availableAmount).to.eq(vestingPlan.rate);
    expect(lockupDetails.totalAmount).to.eq(amount);
    await time.increase(C.MONTH);
    await lockup.connect(b).unlock(['4']);
    expect(await token.balanceOf(b.address)).to.eq(0);
    lockupDetails = await lockup.getVestingLock('4');
    expect(lockupDetails.availableAmount).to.eq(vestingPlan.rate);
    expect(lockupDetails.totalAmount).to.eq(amount);
    // then it will call the redeemVesting again to trigger it to sync the total amount with available amount
    await lockup.connect(b).redeemVestingPlans(['4']);
    // should trigger the catch and sync available amount to total amount
    lockupDetails = await lockup.getVestingLock('4');
    expect(lockupDetails.availableAmount).to.eq(vestingPlan.rate);
    expect(lockupDetails.totalAmount).to.eq(lockupDetails.availableAmount);
    await lockup.connect(b).unlock(['4']);
    expect(await token.balanceOf(b.address)).to.eq(lockupDetails.availableAmount);
    lockupDetails = await lockup.getVestingLock('4');
    expect(lockupDetails.totalAmount).to.eq(0);
    expect(lockupDetails.availableAmount).to.eq(0);
    expect(lockupDetails.token).to.eq(C.ZERO_ADDRESS);
    await expect(lockup.ownerOf('4')).to.be.reverted;
  });
  it('tests the same transfer test but with the plan being revoked', async () => {
    let now = BigInt(await time.latest());
    let amount = C.E18_10000;
    let recipient = {
      beneficiary: c.address,
      adminRedeem: true,
    };
    let vestingPlan = {
      amount,
      start: now,
      cliff: now,
      rate: amount / BigInt(20),
      period: C.WEEK,
    };

    let lockPlan = {
      amount,
      start: now,
      cliff: now,
      rate: amount / BigInt(10),
      period: C.MONTH,
    };
    let tx = await batch.createVestingLockupPlans(
      lockup.target,
      token.target,
      amount,
      [recipient],
      [vestingPlan],
      admin.address,
      true,
      [lockPlan],
      true,
      1
    );
    await time.increase(C.WEEK);
    await lockup.connect(c).redeemVestingPlans(['5']);
    await lockup.connect(c).updateVestingTransferability('5', true);
    await vesting.connect(admin).revokePlans([5]);
    let lockupDetails = await lockup.getVestingLock('5');
    expect(lockupDetails.availableAmount).to.eq(vestingPlan.rate);
    expect(lockupDetails.totalAmount).to.eq(amount);
    await time.increase(C.MONTH);
    await lockup.connect(c).unlock(['5']);
    expect(await token.balanceOf(c.address)).to.eq(0);
    lockupDetails = await lockup.getVestingLock('5');
    expect(lockupDetails.availableAmount).to.eq(vestingPlan.rate);
    expect(lockupDetails.totalAmount).to.eq(amount);
    // then it will call the redeemVesting again to trigger it to sync the total amount with available amount
    await lockup.connect(c).redeemVestingPlans(['5']);
    // should trigger the catch and sync available amount to total amount
    lockupDetails = await lockup.getVestingLock('5');
    expect(lockupDetails.availableAmount).to.eq(vestingPlan.rate);
    expect(lockupDetails.totalAmount).to.eq(lockupDetails.availableAmount);
    await lockup.connect(c).unlock(['5']);
    expect(await token.balanceOf(c.address)).to.eq(lockupDetails.availableAmount);
    //expect that the plan has been deleted and burned
    lockupDetails = await lockup.getVestingLock('5');
    expect(lockupDetails.totalAmount).to.eq(0);
    expect(lockupDetails.availableAmount).to.eq(0);
    expect(lockupDetails.token).to.eq(C.ZERO_ADDRESS);
    await expect(lockup.ownerOf('5')).to.be.reverted;
  });
  it('checks what happens if the plan that was transferred out is transferred back in with a new lockup created', async () => {
    await vesting.transferFrom(a.address, lockup.target, '4');
    let now = BigInt(await time.latest());
    let recipient = {
      beneficiary: b.address,
      adminRedeem: true,
    };
    let vestingPlan = await vesting.plans('4');
    expect(vestingPlan.amount).to.eq(C.E18_10000 - vestingPlan.rate);
    let lockEnd = C.planEnd(now, vestingPlan.amount, vestingPlan.rate * BigInt(2),C.MONTH,);
    let tx = await lockup.createVestingLock(
      recipient,
      '4',
      now,
      now,
      vestingPlan.rate * BigInt(2),
      C.MONTH,
      false,
      true
    );
    expect(tx)
      .to.emit(lockup, 'VestingLockCreated')
      .withArgs('6', '4', b.address, {
        token: token.target,
        totalAmount: vestingPlan.amount,
        availableAmount: BigInt(0),
        start: now,
        cliff: now,
        rate: vestingPlan.rate * BigInt(2),
        period: C.MONTH,
        vestingTokenId: '4',
        vestingAdmin: admin.address,
        transferable: false,
        adminTransferOBO: true,
      }, lockEnd);
      let lockupDetails = await lockup.getVestingLock('6');
      expect(lockupDetails.totalAmount).to.eq(vestingPlan.amount);
      expect(lockupDetails.availableAmount).to.eq(BigInt(0));
      expect(lockupDetails.start).to.eq(now);
      expect(lockupDetails.cliff).to.eq(now);
      expect(lockupDetails.rate).to.eq(vestingPlan.rate * BigInt(2));
      expect(lockupDetails.period).to.eq(C.MONTH);
      expect(lockupDetails.token).to.eq(token.target);
      expect(lockupDetails.vestingTokenId).to.eq('4');
      expect(lockupDetails.vestingAdmin).to.eq(admin.address);
  });
};

module.exports = {
  playground,
};
