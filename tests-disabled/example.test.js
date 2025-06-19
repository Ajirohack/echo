const { expect } = require('chai');
const sinon = require('sinon');

describe('Example Test Suite', function() {
  it('should pass a simple test', function() {
    expect(true).to.be.true;
  });

  it('should demonstrate sinon stub', function() {
    const stub = sinon.stub().returns(42);
    expect(stub()).to.equal(42);
  });
});
