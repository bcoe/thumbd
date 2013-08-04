var aws = require('aws-lib'),
  _ = require('underscore'),
  Saver = require('./saver').Saver;
  
function Client(opts) {
  _.extend(this, {
    awsKey: process.env.AWS_KEY,
    awsSecret: process.env.AWS_SECRET,
    sqsQueue: process.env.SQS_QUEUE, // Queue to listen for thumbnail jobs on.
    s3Bucket: process.env.BUCKET // S3 Bucket to perform thumbnailing within.
  }, opts);

  // Create an SQS client for
  // submitting thumbnailing work.
  this.sqs = aws.createSQSClient(
    this.awsKey,
    this.awsSecret,
    {'path': this.sqsQueue}
  );
}

/**
Upload a local file to S3, so that we can later thumbnail it.

source: path to local file.
destination: key of file in remote s3 bucket.
opts: {s3_storage_class: (STANDARD|REDUCED_REDUNDANCY), s3_acl: (private|public-read)}
callback: fired when image is uploaded.
*/
Client.prototype.upload = function(source, destination, opts, callback) {

  opts = opts || {};

  if (typeof opts == 'function') {
    callback = opts;
    opts = {};
  }

  _.extend(opts, {
    aws_key: this.awsKey,
    aws_secret: this.awsSecret,
    bucket: this.s3Bucket
  });

  var saver = new Saver(opts);

  saver.save(source, destination, callback);
};

/*
Submit a thumbnailing job over SQS.

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