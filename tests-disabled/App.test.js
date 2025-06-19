const { expect } = require('chai');
const sinon = require('sinon');

describe('Application', function() {
  describe('Basic Tests', function() {
    it('should pass a basic test', function() {
      expect(true).to.be.true;
    });

    it('should have access to the expect assertion library', function() {
      const value = 'test';
      expect(value).to.be.a('string');
      expect(value).to.equal('test');
    });

    it('should have access to sinon for stubs and spies', function() {
      const stub = sinon.stub().returns(42);
      const result = stub();
      expect(result).to.equal(42);
      expect(stub.calledOnce).to.be.true;
    });
  });
});
