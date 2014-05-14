var assert = require('assert'),
  Client = require('../lib').Client;

describe('thumbnail', function() {
  it("should create prefix based on originalImagePath", function(done) {
    var client = new Client({
      sqs: {
        sendMessage: function(sqsObject) {
          var obj = JSON.parse(
            sqsObject.MessageBody
          )
          assert.equal(obj.prefix, '/foo/bar');
          done();
        },
        endpoint: {} // adhere to SQS contract.
      },
    });

    client.thumbnail('/foo/bar.jpg', {});
  });
});
