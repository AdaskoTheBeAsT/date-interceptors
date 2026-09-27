const { TestEnvironment } = require('jest-environment-jsdom');

module.exports = class extends TestEnvironment {
  constructor(...args) {
    super(...args);
    // jsdom omits structuredClone; use Node's implementation, including cycles.
    this.global.structuredClone = structuredClone;
  }
};
