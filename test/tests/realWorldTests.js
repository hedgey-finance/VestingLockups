const C = require('../constants');
const { deploy } = require('../fixtures');
const setup = require('../fixtures');
const { expect } = require('chai');
const { time } = require('@nomicfoundation/hardhat-network-helpers');
const { ethers } = require('hardhat');

const clientMTests = () => {
  let deployed, admin, a, b, c, d, token, nvt, vesting, batch, lock, amount;
  it('example 1 complex', async () => {
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
    lock = deployed.votingLock;
    amount = BigInt(247396) * BigInt(10 ** 18);
    period = C.MONTH;
    let firstAmount = BigInt(61849) * BigInt(10 ** 18);
    let secondAmount = BigInt(94401) * BigInt(10 ** 18);
    let thirdAmount = BigInt(38240) * BigInt(10 ** 18);
    let finalAmount = BigInt(52906) * BigInt(10 ** 18);
    expect(firstAmount + secondAmount + thirdAmount + finalAmount).to.equal(amount);
    const recipient = {
      beneficiary: a.address,
      adminRedeem: true,
    };
    let firstVestingDate = BigInt(1719187200);
    let firstVestingPlan = {
      amount: firstAmount,
      start: firstVestingDate,
      cliff: firstVestingDate,
      rate: firstAmount,
    };
    let firstLockStart = BigInt(1725667200);
    let firstLock = {
      amount: firstAmount,
      start: firstLockStart,
      cliff: firstLockStart,
      rate: firstAmount,
    };
    await batch.createVestingLockupPlans(
      vesting.target,
      lock.target,
      token.target,
      BigInt(1),
      admin.address,
      true,
      [firstVestingPlan],
      [recipient],
      [firstLock],
      true,
      firstAmount,
      '1'
    );
    let secondVestingPlan = {
      amount: secondAmount,
      start: firstVestingDate,
      cliff: firstVestingDate,
      rate: secondAmount,
    };
    let sep11 = BigInt(1726012800);
    let secondLock = {
      amount: secondAmount,
      start: sep11,
      cliff: sep11,
      rate: BigInt(2951) * BigInt(10 ** 18),
    };
    let thirdVestingPlan = {
      amount: thirdAmount,
      start: BigInt(1721520000), //july 21
      cliff: BigInt(1721520000),
      rate: BigInt(12747) * BigInt(10 ** 18),
    };
    let thirdLock = {
      amount: thirdAmount,
      start: sep11,
      cliff: sep11,
      rate: BigInt(4780) * BigInt(10 ** 18),
    };
    let finalVestingPlan = {
      amount: finalAmount,
      start: BigInt(1729468800), //october 21 2024
      cliff: BigInt(1729468800),
      rate: BigInt(13227) * BigInt(10 ** 18),
    };
    let finalLock = {
      amount: finalAmount,
      start: BigInt(1746921600), // may 11 2025
      cliff: BigInt(1746921600),
      rate: BigInt(2205) * BigInt(10 ** 18),
    };
    await batch.createVestingLockupPlans(
      vesting.target,
      lock.target,
      token.target,
      C.MONTH,
      admin.address,
      true,
      [secondVestingPlan, thirdVestingPlan, finalVestingPlan],
      [recipient, recipient, recipient],
      [secondLock, thirdLock, finalLock],
      true,
      secondAmount + thirdAmount + finalAmount,
      '2'
    );
    let firstRedemption = BigInt(61849) * BigInt(10 ** 18);
    let secondRedemptions = secondLock.rate + thirdLock.rate;
    let finalRedemption = secondLock.rate + finalLock.rate;

    await time.increaseTo(firstLockStart);
    let tx = await lock.connect(a).redeemAndUnlock([1, 2, 3, 4]);
    expect(await token.balanceOf(a.address)).to.equal(firstRedemption);
    let redemptionTime = sep11 + C.MONTH;
    await time.increaseTo(redemptionTime);
    tx = await lock.connect(a).redeemAndUnlock([2, 3, 4]);
    expect(await token.balanceOf(a.address)).to.equal(secondRedemptions + firstRedemption);
    expect(tx).to.emit(token, 'Transfer').withArgs(lock.target, a.address, secondRedemptions);
    redemptionTime += C.MONTH;
    await time.increaseTo(redemptionTime);
    tx = await lock.connect(a).redeemAndUnlock([2, 3, 4]);
    let redemptions = 2;
    expect(await token.balanceOf(a.address)).to.equal(secondRedemptions * BigInt(redemptions) + firstRedemption);
    expect(tx).to.emit(token, 'Transfer').withArgs(lock.target, a.address, secondRedemptions);
    while (redemptions < 8) {
      redemptions++;
      redemptionTime += C.MONTH;
      await time.increaseTo(redemptionTime);
      tx = await lock.connect(a).redeemAndUnlock([2, 3, 4]);
      expect(await token.balanceOf(a.address)).to.equal(secondRedemptions * BigInt(redemptions) + firstRedemption);
      expect(tx).to.emit(token, 'Transfer').withArgs(lock.target, a.address, secondRedemptions);
    }
    redemptionTime += C.MONTH;
    await time.increaseTo(redemptionTime);
    tx = await lock.connect(a).redeemAndUnlock([2, 4]);
    expect(await token.balanceOf(a.address)).to.equal(
      secondRedemptions * BigInt(redemptions) + firstRedemption + finalRedemption
    );
    expect(tx).to.emit(token, 'Transfer').withArgs(lock.target, a.address, finalRedemption);
    let lastRedemptions = 1;
    while (lastRedemptions < 24) {
      lastRedemptions++;
      redemptionTime += C.MONTH;
      await time.increaseTo(redemptionTime);
      tx = await lock.connect(a).redeemAndUnlock([2, 4]);
      let totalUnlocked = C.bigMin(
        amount,
        finalRedemption * BigInt(lastRedemptions) + secondRedemptions * BigInt(redemptions) + firstRedemption
      );
      expect(await token.balanceOf(a.address)).to.equal(totalUnlocked);
      if (lastRedemptions < 24) {
        expect(tx).to.emit(token, 'Transfer').withArgs(lock.target, a.address, finalRedemption);
      }
    }
    expect(await token.balanceOf(lock.target)).to.equal(0);
    expect(await token.balanceOf(vesting.target)).to.equal(0);
  });
};

const clientM2Test = () => {
  let deployed, admin, a, b, c, d, token, nvt, vesting, batch, lock;
  it('example 2 complex, 20mm total vesting over 4 years, 180 day 25% cliff lockup with 10 months after unlocking at 625k per month then 4167k for 21 months', async () => {
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
    lock = deployed.votingLock;
    let totalAmount = BigInt(20000000) * BigInt(10 ** 18);
    await token.mint(totalAmount);
    await token.approve(batch.target, totalAmount);
    // split into three chunks
    // first chunk of 25% = 5mm
    // vests on cliff date
    // unlocks on single date in sep11
    let firstAmount = BigInt(5000000) * BigInt(10 ** 18);
    // second chunk of 6.25mm
    // 416667 vests per month for 15 months
    // unlocks over 10 months
    let secondAmount = BigInt(6250000) * BigInt(10 ** 18);
    // final amount of 8.75mm
    // vests and unlocks over 21 months
    let finalAmount = BigInt(8750000) * BigInt(10 ** 18);
    expect(firstAmount + secondAmount + finalAmount).to.equal(totalAmount);
    const recipient = {
      beneficiary: b.address,
      adminRedeem: true,
    };
    let firstVestingDate = BigInt(1692748800); //aug 23 2023
    let lockupInitialStart = BigInt(1726012800);
    let firstVestingPlan = {
      amount: firstAmount,
      start: firstVestingDate,
      cliff: firstVestingDate,
      rate: firstAmount,
    };
    let firstUnlock = {
      amount: firstAmount,
      start: lockupInitialStart,
      cliff: lockupInitialStart,
      rate: firstAmount,
    };
    let secondVestingPlan = {
      amount: secondAmount,
      start: firstVestingDate + C.MONTH,
      cliff: firstVestingDate + C.MONTH,
      rate: BigInt(416667) * BigInt(10 ** 18),
    };
    let secondUnlock = {
      amount: secondAmount,
      start: lockupInitialStart,
      cliff: lockupInitialStart,
      rate: BigInt(625000) * BigInt(10 ** 18),
    };
    let thirdVestingPlan = {
      amount: finalAmount,
      start: BigInt(1734912000), //december 23 2024,
      cliff: BigInt(1734912000),
      rate: BigInt(416667) * BigInt(10 ** 18),
    };
    let thirdUnlock = {
      amount: finalAmount,
      start: BigInt(1752192000), // july 11 2025
      cliff: BigInt(1752192000),
      rate: BigInt(416667) * BigInt(10 ** 18),
    };
    await batch.createVestingLockupPlans(
      vesting.target,
      lock.target,
      token.target,
      C.MONTH,
      admin.address,
      true,
      [firstVestingPlan, secondVestingPlan, thirdVestingPlan],
      [recipient, recipient, recipient],
      [firstUnlock, secondUnlock, thirdUnlock],
      true,
      totalAmount,
      '3'
    );
    expect((await vesting.plans(1)).period).to.eq(C.MONTH);
    expect((await lock.getVestingLock(1)).period).to.eq(1);
    let firstVestingEnd = await vesting.planEnd(1);
    let firstLockEnd = await lock.getLockEnd(1);
    expect(firstVestingEnd).to.equal(firstVestingDate + C.MONTH);
    expect(firstLockEnd).to.equal(lockupInitialStart + BigInt(1));
    let secondVestingEnd = await vesting.planEnd(2);
    let secondLockEnd = await lock.getLockEnd(2);
    expect(secondVestingEnd).to.equal(secondVestingPlan.start + C.MONTH * BigInt(15));
    expect(secondLockEnd).to.equal(secondUnlock.start + C.MONTH * BigInt(10));
    let thirdVestingEnd = await vesting.planEnd(3);
    let thirdLockEnd = await lock.getLockEnd(3);
    expect(thirdVestingEnd).to.equal(thirdVestingPlan.start + C.MONTH * BigInt(21));
    expect(thirdLockEnd).to.equal(thirdUnlock.start + C.MONTH * BigInt(21));

    // redeems the first vesting cliff that has already vested but is still locked
    let tx = await lock.redeemVestingPlans([1]);
    expect(tx).to.emit(token, 'Transfer').withArgs(vesting.target, lock.target, firstAmount);
    expect(await token.balanceOf(lock.target)).to.equal(firstAmount);

    await time.increaseTo(firstLockEnd);
    tx = await lock.redeemAndUnlock([1]);
    // tx = await lock.unlock([1]);
    expect(tx).to.emit(token, 'Transfer').withArgs(lock.target, b.address, firstAmount);
    let secondRedemptions = 0;
    while (secondRedemptions < 10) {
      secondRedemptions++;
      await time.increase(C.MONTH);
      tx = await lock.redeemAndUnlock([2]);
      expect(tx).to.emit(token, 'Transfer').withArgs(lock.target, b.address, secondUnlock.rate);
    }
    let thirdRedemptions = 0;
    while (thirdRedemptions < 21) {
      thirdRedemptions++;
      await time.increase(C.MONTH);
      tx = await lock.redeemAndUnlock([3]);
      expect(tx).to.emit(token, 'Transfer').withArgs(lock.target, b.address, thirdUnlock.rate);
    }
    expect(await token.balanceOf(lock.target)).to.equal(0);
    expect(await token.balanceOf(vesting.target)).to.equal(0);
    expect(await token.balanceOf(b.address)).to.equal(totalAmount);
  });
};

module.exports = {
  clientMTests,
  clientM2Test,
};
