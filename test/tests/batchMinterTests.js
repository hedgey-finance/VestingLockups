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
        let end = C.planEnd(now, amount, amount / BigInt(12), C.MONTH)
        let plan = {
            amount,
            start: now,
            cliff: now,
            rate: amount / BigInt(12),
            period: C.MONTH,
        };
        let plans = [plan, plan, plan];
        let recipients = [a.address, b.address, c.address];
        let tx = await batch.batchLockupPlans(
            lockup.target,
            token.target,
            amount,
            recipients,
            plans,
            '4'
        );
        expect(tx).to.emit(batch, 'LockupBatchCreated').withArgs(admin.address, token.target, 3, [1, 2, 3], totalAmount, '4');
        expect(tx).to.emit(lockup, 'PlanCreated').withArgs('1', a.address, token.target, amount, plan.start, plan.cliff, end, plan.rate, plan.period);
        expect(tx).to.emit(lockup, 'PlanCreated').withArgs('2', b.address, token.target, amount, plan.start, plan.cliff, end, plan.rate, plan.period);
        expect(tx).to.emit(lockup, 'PlanCreated').withArgs('3', c.address, token.target, amount, plan.start, plan.cliff, end, plan.rate, plan.period);
        expect(tx).to.emit(token, 'Transfer').withArgs(admin.address, batch.address, totalAmount);
        expect(tx).to.emit(token, 'Transfer').withArgs(batch.address, lockup.target, amount);
        expect(await token.balanceOf(lockup.target)).to.eq(totalAmount);
        expect(await lockup.ownerOf('1')).to.eq(a.address);
        expect(await lockup.ownerOf(2)).to.eq(b.address);
        expect(await lockup.ownerOf(3)).to.eq(c.address);
    })
}


module.exports = {
    batchMinterTests,
}
