const C = require('../constants');
const { deploy } = require('../fixtures');
const setup = require('../fixtures');
const { expect } = require('chai');
const { time } = require('@nomicfoundation/hardhat-network-helpers');
const { ethers } = require('hardhat');

const clientMTests = () => {
  let deployed, admin, a, b, c, d, token, nvt, vesting, batch, lock;
  let amount, vestingStart, vestingCliff, vestingRate, period, vestingEnd, vestingAdmin;
  let lockStart, lockCliff, lockRate, lockEnd;
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
    expect(await token.balanceOf(a.address)).to.equal((secondRedemptions * BigInt(redemptions)) + firstRedemption);
    expect(tx).to.emit(token, 'Transfer').withArgs(lock.target, a.address, secondRedemptions);
    while (redemptions < 8 ) {
      redemptions++;
      redemptionTime += C.MONTH;
      await time.increaseTo(redemptionTime);
      tx = await lock.connect(a).redeemAndUnlock([2, 3, 4]);
      expect(await token.balanceOf(a.address)).to.equal((secondRedemptions * BigInt(redemptions)) + firstRedemption);
      expect(tx).to.emit(token, 'Transfer').withArgs(lock.target, a.address, secondRedemptions);
    }
    redemptionTime += C.MONTH;
    await time.increaseTo(redemptionTime);
    tx = await lock.connect(a).redeemAndUnlock([2, 4]);
    expect(await token.balanceOf(a.address)).to.equal((secondRedemptions * BigInt(redemptions)) + firstRedemption + finalRedemption);
    expect(tx).to.emit(token, 'Transfer').withArgs(lock.target, a.address, finalRedemption);
    let lastRedemptions = 1;
    while (lastRedemptions < 24) {
      lastRedemptions++;
      redemptionTime += C.MONTH;
      await time.increaseTo(redemptionTime);
      tx = await lock.connect(a).redeemAndUnlock([2, 4]);
      let totalUnlocked = C.bigMin(amount, (finalRedemption * BigInt(lastRedemptions)) + (secondRedemptions * BigInt(redemptions)) + firstRedemption)
      expect(await token.balanceOf(a.address)).to.equal(totalUnlocked);
      if (lastRedemptions < 24) {
        expect(tx).to.emit(token, 'Transfer').withArgs(lock.target, a.address, finalRedemption);
      }
    }
  });
};

module.exports = {
  clientMTests,
};
