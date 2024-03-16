const C = require('./constants');
const { createTests, createErrorTests } = require('./tests/createTests');
const happyPath = require('./tests/happyPath');
const { clientMTests, clientM2Test } = require('./tests/realWorldTests');
const { playground } = require('./tests/playground');



const paramsMatrix = [
    {
        decimals: 18,
        voting: false,
        amount: C.E18_100,
        start: 0,
        cliff: 0,
        duration: C.MONTH,
        vestingPeriod: 1,
        lockStart: C.WEEK,
        lockCliff: C.WEEK,
        lockDuration: C.WEEK * BigInt(4),
        lockPeriod: C.WEEK,
        adminRedeem: true,
    }
]


// describe('Testing the happy path', () => {
//     paramsMatrix.forEach((params) => {
//         happyPath(params);
//     });
// });

describe('Testing the various playground tests', () => {
    playground();
})

