const C = require('../constants');
const { deploy } = require('../fixtures');
const { expect } = require('chai');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

// these tests are strictly for the batchcreator contract that is replacing an older batch minter contract for the vesting and lockups contracts

const batchMinterTests = (voting) => {
  let deployed, admin, a, b, c, d, token, vesting, batch, lockup;
  it('creates a batch of lockup plans', async () => {
    deployed = await deploy(18);
    admin = deployed.admin;
    a = deployed.a;
    b = deployed.b;
    c = deployed.c;
    d = deployed.d;
    token = deployed.token;
    batch = deployed.batch;
    lockup = voting ? deployed.votingLockup : deployed.tokenLockup;
    vesting = voting ? deployed.vvp : deployed.tvp;
    let now = BigInt(await time.latest());
    let amount = C.E18_10000;
    let totalAmount = amount * BigInt(3);
    let end = C.planEnd(now, amount, amount / BigInt(12), C.MONTH);
    let plan = {
      amount,
      start: now,
      cliff: now,
      rate: amount / BigInt(12),
      period: C.MONTH,
    };
    let plans = [plan, plan, plan];
    let recipients = [a.address, b.address, c.address];
    let tx = await batch.batchLockupPlans(lockup.target, token.target, totalAmount, recipients, plans, '4');
    expect(tx)
      .to.emit(batch, 'LockupBatchCreated')
      .withArgs(admin.address, token.target, 3, [1, 2, 3], totalAmount, '4');
    expect(tx)
      .to.emit(lockup, 'PlanCreated')
      .withArgs('1', a.address, token.target, amount, plan.start, plan.cliff, end, plan.rate, plan.period);
    expect(tx)
      .to.emit(lockup, 'PlanCreated')
      .withArgs('2', b.address, token.target, amount, plan.start, plan.cliff, end, plan.rate, plan.period);
    expect(tx)
      .to.emit(lockup, 'PlanCreated')
      .withArgs('3', c.address, token.target, amount, plan.start, plan.cliff, end, plan.rate, plan.period);
    expect(tx).to.emit(token, 'Transfer').withArgs(admin.address, batch.address, totalAmount);
    expect(tx).to.emit(token, 'Transfer').withArgs(batch.address, lockup.target, amount);
    expect(await token.balanceOf(lockup.target)).to.eq(totalAmount);
    expect(await lockup.ownerOf(1)).to.eq(a.address);
    expect(await lockup.ownerOf(2)).to.eq(b.address);
    expect(await lockup.ownerOf(3)).to.eq(c.address);

    let delegates = [d.address, b.address, c.address];
    tx = await batch.batchLockupPlansWithDelegation(
      lockup.target,
      token.target,
      totalAmount,
      recipients,
      delegates,
      plans,
      '5'
    );
    expect(tx)
      .to.emit(batch, 'LockupBatchCreated')
      .withArgs(admin.address, token.target, 3, [4, 5, 6], totalAmount, '4');
    expect(tx)
      .to.emit(lockup, 'PlanCreated')
      .withArgs('4', a.address, token.target, amount, plan.start, plan.cliff, end, plan.rate, plan.period);
    expect(tx)
      .to.emit(lockup, 'PlanCreated')
      .withArgs('5', b.address, token.target, amount, plan.start, plan.cliff, end, plan.rate, plan.period);
    expect(tx)
      .to.emit(lockup, 'PlanCreated')
      .withArgs('6', c.address, token.target, amount, plan.start, plan.cliff, end, plan.rate, plan.period);
    expect(tx).to.emit(token, 'Transfer').withArgs(admin.address, batch.address, totalAmount);
    expect(tx).to.emit(token, 'Transfer').withArgs(batch.address, lockup.target, amount);
    expect(await lockup.ownerOf(4)).to.eq(a.address);
    expect(await lockup.ownerOf(5)).to.eq(b.address);
    expect(await lockup.ownerOf(6)).to.eq(c.address);
    if (voting) {
      expect(await token.balanceOf(lockup.target)).to.eq(totalAmount);
      let vaultA = await lockup.votingVaults(4);
      expect(await token.balanceOf(vaultA)).to.eq(amount);
      expect(await token.getVotes(d.address)).to.eq(amount);
      let vaultB = await lockup.votingVaults(5);
      expect(await token.balanceOf(vaultB)).to.eq(amount);
      expect(await token.getVotes(b.address)).to.eq(amount);
      let vaultC = await lockup.votingVaults(6);
      expect(await token.balanceOf(vaultC)).to.eq(amount);
      expect(await token.getVotes(c.address)).to.eq(amount);
    } else {
      expect(await token.balanceOf(lockup.target)).to.eq(totalAmount + totalAmount);
      expect(await lockup.delegatedTo(4)).to.eq(d.address);
      expect(await lockup.delegatedTo(5)).to.eq(b.address);
      expect(await lockup.delegatedTo(6)).to.eq(c.address);
    }
  });
  it('creates batches of vesting plans', async () => {
    let now = BigInt(await time.latest());
    let amount = C.E18_10000;
    let totalAmount = amount * BigInt(3);
    let end = C.planEnd(now, amount, amount / BigInt(12), C.MONTH);
    let plan = {
      amount,
      start: now,
      cliff: now,
      rate: amount / BigInt(12),
      period: C.MONTH,
    };
    let plans = [plan, plan, plan];
    let recipients = [a.address, b.address, c.address];
    let tx = await batch.batchVestingPlans(vesting.target, token.target, totalAmount, recipients, plans, admin.address, false, '4');
    expect(tx)
      .to.emit(batch, 'VestingBatchCreated')
      .withArgs(admin.address, token.target, 3, [1, 2, 3], totalAmount, '4');
    expect(tx).to.emit(vesting, 'PlanCreated').withArgs('1', a.address, token.target, amount, plan.start, plan.cliff, end, plan.rate, plan.period, admin.address, false);
    expect(tx).to.emit(vesting, 'PlanCreated').withArgs('2', b.address, token.target, amount, plan.start, plan.cliff, end, plan.rate, plan.period, admin.address, false);
    expect(tx).to.emit(vesting, 'PlanCreated').withArgs('3', c.address, token.target, amount, plan.start, plan.cliff, end, plan.rate, plan.period, admin.address, false);
    expect(await token.balanceOf(vesting.target)).to.eq(totalAmount);
    expect(tx).to.emit(token, 'Transfer').withArgs(admin.address, batch.address, totalAmount);
    expect(tx).to.emit(token, 'Transfer').withArgs(batch.address, vesting.target, amount);
    expect(await vesting.ownerOf(1)).to.eq(a.address);
    expect(await vesting.ownerOf(2)).to.eq(b.address);
    expect(await vesting.ownerOf(3)).to.eq(c.address);

    let delegates = [d.address, b.address, c.address];
    tx = await batch.batchVestingPlansWithDelegation(vesting.target, token.target, totalAmount, recipients, delegates, plans, admin.address, '5');
    expect(tx)
      .to.emit(batch, 'VestingBatchCreated')
      .withArgs(admin.address, token.target, 3, [4, 5, 6], totalAmount, '5');
    expect(tx).to.emit(vesting, 'PlanCreated').withArgs('4', a.address, token.target, amount, plan.start, plan.cliff, end, plan.rate, plan.period, admin.address, false);
    expect(tx).to.emit(vesting, 'PlanCreated').withArgs('5', b.address, token.target, amount, plan.start, plan.cliff, end, plan.rate, plan.period, admin.address, false);
    expect(tx).to.emit(vesting, 'PlanCreated').withArgs('6', c.address, token.target, amount, plan.start, plan.cliff, end, plan.rate, plan.period, admin.address, false);
    if (voting) {
        expect(await token.balanceOf(vesting.target)).to.eq(totalAmount);
        let vaultA = await vesting.votingVaults(4);
        expect(await token.balanceOf(vaultA)).to.eq(amount);
        expect(await token.getVotes(d.address)).to.eq(amount +  amount);
        let vaultB = await vesting.votingVaults(5);
        expect(await token.balanceOf(vaultB)).to.eq(amount);
        expect(await token.getVotes(b.address)).to.eq(amount + amount);
        let vaultC = await vesting.votingVaults(6);
        expect(await token.balanceOf(vaultC)).to.eq(amount);
        expect(await token.getVotes(c.address)).to.eq(amount + amount);
    } else {
        expect(await token.balanceOf(vesting.target)).to.eq(totalAmount + totalAmount);
        expect(await vesting.delegatedTo(4)).to.eq(d.address);
        expect(await vesting.delegatedTo(5)).to.eq(b.address);
        expect(await vesting.delegatedTo(6)).to.eq(c.address);
    }
  })
};

module.exports = {
  batchMinterTests,
};
