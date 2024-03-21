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
        adminRedeem: true
    }
    let vestingPlan = {
        amount,
        start: now,
        cliff: now,
        rate: amount / C.YEAR,
        period: BigInt(1),
    }
    console.log(`vesting rate: ${vestingPlan.rate}`);
    
    let lockPlan = {
        amount,
        start: now,
        cliff: now,
        rate: amount / BigInt(53), // 53 weeks lockup
        period: C.WEEK,
    }
    console.log(`lockup rate: ${lockPlan.rate}`);
    let tx = await batch.createVestingLockupPlans(vesting.target, lockup.target, token.target, [recipient], [vestingPlan], admin, true, [lockPlan], true, amount, 1);
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
    console.log(`current time: ${await time.latest()}`)
    // test now callig redeemAndUnlock now - which should redeem more and unlock the next period to reset to current time
    unlockTx = await lockup.connect(a).redeemAndUnlock(['1']);
    expect(unlockTx).to.emit(token, 'Transfer').withArgs(lockup.target, a.address, lockPlan.rate);
    lockPlan1 = await lockup.getVestingLock('1');
    console.log(`updated start date is now: ${lockPlan1.start}`);
    expect(lockPlan1.start).to.eq(lockPlan.start + lockPlan.period + lockPlan.period);
    // need to test the end for when the available amount == total amount and is less than a single period
    await time.increaseTo(await vesting.planEnd('1'));
    now = BigInt(await time.latest())
    console.log(`new time: ${now}`);
    console.log(`number of weeks passed: ${(now - lockPlan.start) / lockPlan.period}`)
    await lockup.connect(a).redeemAndUnlock(['1']);
    //should have redeemed the entire balance, and unlocked all 52 of 53 weeks, should be one weeks worth remaining
    let remainder = await token.balanceOf(lockup.target);
    console.log(`remainder tokens for final week: ${remainder}`);
    console.log(`difference of remainder vs rate: ${lockPlan.rate - remainder}`);
    // expect(lockPlan.rate).to.be.greaterThan(remainder);
    lockPlan1 = await lockup.getVestingLock('1');
    console.log(`difference of total and available: ${lockPlan1.totalAmount - lockPlan1.availableAmount}`);
    console.log(`vesting plan: ${await vesting.plans('1')}`)
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
            adminRedeem: true
        }
        let vestingPlan = {
            amount,
            start: now,
            cliff: now,
            rate: amount / BigInt(12),
            period: C.MONTH,
        }
        console.log(`vesting rate: ${vestingPlan.rate}`);
        
        let lockPlan = {
            amount,
            start: now,
            cliff: now,
            rate: amount / (C.YEAR + C.YEAR), //2 years
            period: BigInt(1),
        }
        console.log(`lockup rate: ${lockPlan.rate}`);
        let tx = await batch.createVestingLockupPlans(vesting.target, lockup.target, token.target, [recipient], [vestingPlan], admin, true, [lockPlan], true, amount, 1);
        let lockPlan2 = await lockup.getVestingLock('2');
        console.log(`original start date: ${lockPlan2.start}`);
        //check unlocking in 1 month
        tx = await lockup.connect(a).redeemAndUnlock(['2']);
        await time.increase(C.MONTH);
        tx = await lockup.connect(a).redeemAndUnlock(['2']);
        
    })
}


module.exports = {
    playground,
}