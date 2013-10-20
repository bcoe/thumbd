var aws = require('aws-sdk'),
	config = require('./config').Config,
	Saver = require('./saver').Saver;

/**
 * Initialize the Client
 *
 * @param object opts The Client options
 */
function Client(opts) {
	config.extend(opts);

	// Create an SQS client for
	// submitting thumbnailing work.
	this.sqs = new aws.SQS({
		accessKeyId: config.get('awsKey'),
		secretAccessKey: config.get('awsSecret'),
		region: config.get('awsRegion')
	});

	config.set('sqsQueueUrl', this.sqs.endpoint.protocol + '//' + this.sqs.endpoint.hostname + '/' + config.get('sqsQueue'));
}

/**
 * Upload a local file to S3, so that we can later thumbnail it.
 *
 * @param string source path to local file.
 * @param string destination key of file in remote s3 bucket.
 * @param function callback fired when image is uploaded. Optional.
 */
Client.prototype.upload = function(source, destination, callback) {
	var saver = new Saver();
	saver.save(source, destination, callback);
};

/**
 * Submit a thumbnailing job over SQS.
 *
 * @param string originalImagePath Path to the image in S3 that thumbnailing should be performed on.
 * @param array thumbnailDescriptions Thumbnailing meta information, see README.md.
 * @param function callback The callback function. Optional.
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
	this.sqs.sendMessage({QueueUrl: config.get('sqsQueueUrl'), MessageBody: JSON.stringify({
		original: originalImagePath,
		descriptions: thumbnailDescriptions
	})}, function (err, result) {
		if (callback) callback(err, result);
	});
};

exports.Client = Client;
