var assert = require('assert'),
  config = require('../lib').Config,
  Grabber = require('../lib').Grabber,
  nock = require('nock');

describe('Grabber', function() {
  
  describe('download', function() {

    config.extend({
      awsSecret: 'foo-secret',
      logLevel: 'silent'
    });

    it("should call save with meta-headers returned by AWS", function(done) {
      var grabber = new Grabber(),
        mockDownload = nock('https://my-bucket.s3.amazonaws.com')
          .defaultReplyHeaders({
            'x-amz-meta-foo': 'bar'
          })
          .get('/foo/awesome.jpg')
          .reply(200);

      grabber.download('my-bucket', 'us-east-1', '/foo/awesome.jpg', function(err, data, headers) {
        mockDownload.done();
        assert.equal(headers['x-amz-meta-foo'], 'bar');
        return done();
      });
    });
  });

});
