const C = require('./constants');
const { createTests, createErrorTests } = require('./tests/createTests');
const happyPath = require('./tests/happyPath');
const { clientMTests, clientM2Test } = require('./tests/realWorldTests');
const { hackerTests } = require('./tests/hackerTests');


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
        lockDuration: C.MONTH,
        adminRedeem: true,
    }
]

const fuzzTests = [
    {
        decimals: 18,
        amount: C.randomBigNum(1000000000, 1000, 18),
        start: C.DAY,
        cliff: C.DAY,
        duration: C.MONTH * BigInt(12),
        period: C.DAY,
        lockStart: BigInt(0),
        lockCliff: BigInt(0),
        lockDuration: C.MONTH * BigInt(15),
        adminRedeem: false,
    }
]


// describe('Testing the happy path', () => {
//     paramsMatrix.forEach((params) => {
//         happyPath(params);
//     });
// });

// describe('Testing the real world tests', () => {
    // clientMTests();
    // clientM2Test();
// })

describe('Trying to redeem early or break the vesting lockup plans', () => {
    fuzzTests.forEach((test) => {
        hackerTests(test);
    });
})