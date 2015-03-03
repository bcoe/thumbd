var assert = require('assert'),
  config = require('../lib').Config,
  nock = require('nock');
  Saver = require('../lib').Saver;

describe('Saver', function() {

  config.extend({
    awsSecret: 'foo-secret',
    logLevel: 'silent'
  });

  describe('save', function() {

    it("should set additional metadata headers when saving", function(done) {
      var saver = new Saver(),
        mockUpload = nock('https://my-bucket.s3.amazonaws.com', {
            reqheaders: {
              'x-amz-meta-foo': 'bar'
            }
          })
          .put('/foo/apple.jpg')
          .reply(200);

      saver.save('my-bucket', 'us-east-1', './test/fixtures/test.jpg', '/foo/apple.jpg', {
        'x-amz-meta-foo': 'bar'
      }, function(err) {
        mockUpload.done();
        return done();
      });
    });
  });

});
