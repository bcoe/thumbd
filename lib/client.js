var aws = require('aws-lib'),
  _ = require('underscore');
  
function Client(opts) {
  _.extend(this, {
    awsKey: process.env.AWS_KEY,
    awsSecret: process.env.AWS_SECRET,
    sqsQueue: process.env.SQS_QUEUE
  }, opts);

  // Create an SQS client for
  // submitting thumbnailing work.
  this.sqs = aws.createSQSClient(
    this.awsKey,
    this.awsSecret,
    {'path': this.sqsQueue}
  );
}

/*
originalImagePath: the path to the image in S3 that thumbnailing should be performed on.
thumbnailDescriptions: array of thumbnailing meta information, see README.markdown.
*/
Client.prototype.thumbnail = function(originalImagePath, thumbnailDescriptions, callback) {
  /**
    job = {
      "original": "/foo/awesome.jpg",
      "descriptions": [{
        "suffix": "small",
        "width": 64,
        "height": 64
      }],
    }
  */
  this.sqs.call ( "SendMessage", {MessageBody: JSON.stringify({
    original: originalImagePath,
    descriptions: thumbnailDescriptions
  })}, function (err, result) {
    if (callback) callback(err, result);
  });
};

exports.Client = Client;