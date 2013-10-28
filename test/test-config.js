var assert = require('assert');

describe('#Config', function() {
  it("should keep settings if config required multiple times", function() {
    var Config = require('../lib/config').Config;

    Config.set('awsKey', 'abc123');

    Config = require('../lib/config').Config;

    assert.equal(Config.get('awsKey'), 'abc123');
  });
});