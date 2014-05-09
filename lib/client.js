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
	this.job({
		resources: [ originalImagePath ],
		prefix: originalImagePath.split('.').slice(0, -1).join('.'),
		descriptions: thumbnailDescriptions
	}, function (err, result) {
		if (callback) callback(err, result);
	});
};

/**
 * Submit a job over SQS.
 *
 * @param array resources An array of s3 resoures to download to be used in this task.
 * @param string prefix The prefix of where to save the output back on s3.
 * @param array taskDescriptions Task meta information, see README.md.
 * @param function callback The callback function. Optional.
 */
Client.prototype.job = function(job, callback) {
	/**
		job = {
			"resources": [
				"/foo/awesome.jpg",
				"/foo/pictures.jpg",
				"/foo/here.jpg"
			],
			"prefix": "/foo/montage",
			"descriptions": [{
				"suffix": "small",
				"width": 64,
				"height": 64
			}],
			"notify": "http://url.to.ping/when/job/is/complete"
		}
	*/
	this.sqs.sendMessage({QueueUrl: config.get('sqsQueueUrl'), MessageBody: JSON.stringify(job)}, function (err, result) {
		if (callback) callback(err, result);
	});
};

exports.Client = Client;
