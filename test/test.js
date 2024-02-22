const C = require('./constants');
const { createTests, createErrorTests } = require('./tests/createTests');


const paramsMatrix = [
    {
        decimals: 18,
        voting: false,
        amount: C.E18_100,
        start: 0,
        cliff: 0,
        duration: C.MONTH,
        period: 1,
        lockStart: C.WEEK,
        lockCliff: C.WEEK,
        lockPeriod: 1,
        lockDuration: C.MONTH,
        adminRedeem: true,
    }
]


describe('Testing creating vesting plans with lockup', () => {
    paramsMatrix.forEach((params) => {
        createTests(params);
    });
});