const {partial} = require('../lib/func_utils');
const {expect, assert} = require('chai');

describe('Functional Utility Tests', ()=>{
    it("Should test that the partial application utility returns a function", ()=>{
        const func = partial((a,b)=>{}, 1);
        expect(typeof func).to.equal('function');
    });

    it("Should test the partial application application of a simple add function", ()=>{
        function add(a, b) {return a+b};

        const add5 = partial(add, 5);
        expect(add5(6)).to.equal(11);
    });
});
