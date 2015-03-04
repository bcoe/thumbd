var aws = require('aws-sdk'),
	config = require('./config').Config,
	_ = require('lodash');

/**
 * Initialize the Client
 *
 * @param object opts The Client options
 */
function Client(opts) {
	// update client instance and config
	// with overrides from opts.
	_.extend(this, {
		Saver: require('./saver').Saver
	}, opts);

	config.extend(opts);

	// allow sqs to be overridden
	// in tests.
	if (opts && opts.sqs) {
		this.sqs = opts.sqs;
		delete opts.sqs;
	} else {
		this.sqs = new aws.SQS({
			accessKeyId: config.get('awsKey'),
			secretAccessKey: config.get('awsSecret'),
			region: config.get('awsRegion')
		});
	}

	config.set('sqsQueueUrl', this.sqs.endpoint.protocol + '//' + this.sqs.endpoint.hostname + '/' + config.get('sqsQueue'));
}

/**
 * Upload a local file to S3, so that we can later thumbnail it.
 *
 * @param string source path to local file.
 * @param string destination key of file in remote s3 bucket.
 * @param object opts(optional) optional region/bucket.
 * @param function callback fired when image is uploaded. Optional.
 */
Client.prototype.upload = function(source, destination, opts, callback) {
	var saver = new this.Saver();

	// the options hash is optional.
	if (typeof opts === 'function') {
		callback = opts;
		opts = {};
	}
		// merge the options hash with defaults from config.
	opts = _.extend({
		awsRegion: config.get('awsRegion'),
		s3Bucket: config.get('s3Bucket')
	}, opts);

	saver.save(opts.s3Bucket, opts.awsRegion, source, destination, opts.headers, callback);
};

/**
 * Submit a thumbnailing job over SQS.
 *
 * @param string originalImagePaths Path to the image in S3 that thumbnailing should be performed on,
 *    can optionally be an array of resources.
 * @param array thumbnailDescriptions Thumbnailing meta information, see README.md.
 * @param object opts additional options
 *   @opt prefix alternative prefix for saving thumbnail.
 * @param function callback The callback function. Optional.
 */
Client.prototype.thumbnail = function(originalImagePaths, thumbnailDescriptions, opts, callback) {
	/**
		job = {
			"resources": [
				"/foo/awesome.jpg"
			],
			"prefix": "/foo/awesome",
			"descriptions": [{
				"suffix": "small",
				"width": 64,
				"height": 64
			}],
		}
	*/

	// additional options can be provided.
	if (typeof opts === 'function') {
		callback = opts;
		opts = {};
	}

	// allow for either a single S3 resource, or an array.
	if (!_.isArray(originalImagePaths)) originalImagePaths = [originalImagePaths];

	// override defaults with opts.
	opts = _.extend({
		prefix: originalImagePaths[0].split('.').slice(0, -1).join('.'),
		resources: originalImagePaths,
		descriptions: thumbnailDescriptions
	}, opts);

	this.sqs.sendMessage({QueueUrl: config.get('sqsQueueUrl'), MessageBody: JSON.stringify(opts)}, function (err, result) {
		if (callback) callback(err, result);
	});
};

exports.Client = Client;
