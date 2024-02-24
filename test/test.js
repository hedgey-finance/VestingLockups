const C = require('./constants');
const { createTests, createErrorTests } = require('./tests/createTests');
const happyPath = require('./tests/happyPath');
const { clientMTests } = require('./tests/realWorldTests');


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


// describe('Testing the happy path', () => {
//     paramsMatrix.forEach((params) => {
//         happyPath(params);
//     });
// });

describe('Testing the real world tests', () => {
    clientMTests();
})