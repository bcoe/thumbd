var aws = require('aws-sdk'),
	_ = require('underscore'),
	config = require('./config').Config,
	Grabber = require('./grabber').Grabber,
	Thumbnailer = require('./thumbnailer').Thumbnailer,
	Saver = require('./saver').Saver,
	fs = require('fs'),
	async = require('async');

/**
 * Initialize the Worker
 *
 * @param object opts Worker configuration. Optional.
 */
function Worker(opts) {
	_.extend(this, {
		thumbnailer: null,
		grabber: null,
		saver: null
	}, opts);

	this.sqs = new aws.SQS({
		accessKeyId: config.get('awsKey'),
		secretAccessKey: config.get('awsSecret'),
		region: config.get('awsRegion')
	});

	config.set('sqsQueueUrl', this.sqs.endpoint.protocol + '//' + this.sqs.endpoint.hostname + '/' + config.get('sqsQueue'));
}

/**
 * Start the worker
 */
Worker.prototype.start = function() {
	this._processSQSMessage();
};

/**
 * Process the next message in the queue
 */
Worker.prototype._processSQSMessage = function() {
	var _this = this;

	console.log('wait for message on ' + config.get('sqsQueue'));

	this.sqs.receiveMessage( { QueueUrl: config.get('sqsQueueUrl'), MaxNumberOfMessages: 1 }, function (err, job) {
		if (err) {
			console.log(err);
			_this._processSQSMessage();
			return;
		}

		if (!job.Messages || job.Messages.length === 0) {
			_this._processSQSMessage();
			return;
		}

		// Handle the message we pulled off the queue.
		var handle = job.Messages[0].ReceiptHandle,
			body = null;

		try { // a JSON string message body is accepted.
			body = JSON.parse( job.Messages[0].Body );
		} catch(e) {
			if (e instanceof SyntaxError) {
				// a Base64 encoded JSON string message body is also accepted.
				body = JSON.parse( new Buffer(job.Messages[0].Body, 'base64').toString( 'binary' ) );
			} else {
				// TODO: figure out if throwing is actually
				// the right thing to do here.
				throw e;
			}
		}

		_this._runJob(handle, body, function() {
			_this._processSQSMessage();
		});
	});
};

/**
 * Process a job from the queue
 *
 * @param string handle The SQS message handle
 * @param object job The job parameters
 * @param function callback The callback function
 */
Worker.prototype._runJob = function(handle, job, callback) {
	/**
		job = {
			"original": "/foo/awesome.jpg",
			// OR:
			"resources": [
			// List of resources to download
			],
			"prefix": "/foo/awesome",
			"descriptions": [{
				"suffix": "small",
				"width": 64,
				"height": 64
			}],
		}
	*/

	// handle legacy, 'original' key vs. 'resources'.
	if (job.original) job.resources = [job.original];

	var _this = this;

	async.mapLimit(job.resources, 5, function(resource, done) {
		_this._downloadFromS3(resource, done);
	}, function(err, localPaths) {
		if (err) {
			// We don't delete the job,
			// in hopes that on the next retry
			// it will succeed.
			console.log(err);
			callback();
			return;
		}
		_this._createThumbnails(localPaths, job, function(err) {
			async.forEach(localPaths, fs.unlink, function(err) {
				if (!err) {
					_this._deleteJob(handle);
				}
				callback();
			});
		});
	});
};

/**
 * Download the image from S3
 *
 * @param string remoteImagePath The s3 path to the image
 * @param function callback The callback function
 */
Worker.prototype._downloadFromS3 = function(remoteImagePath, callback) {
	this.grabber.download(remoteImagePath, function(err, localPath) {
		// Leave the job in the queue if an error occurs.
		if (err) {
			callback(err);
			return;
		}

		callback(null, localPath);
	});
};

/**
 * Create thumbnails for the image
 *
 * @param string localPath The local path to store the images
 * @param object job The job description
 * @param function callback The callback function
 */
Worker.prototype._createThumbnails = function(localPaths, job, callback) {

	var _this = this,
		work = [];

	// Create thumbnailing work for each thumbnail description.
	job.descriptions.forEach(function(description) {
		work.push(function(done) {

			var remoteImagePath = _this._thumbnailKey(job.prefix, description.suffix, description.format),
				thumbnailer = new Thumbnailer();

			thumbnailer.execute(description, localPaths, function(err, convertedImagePath) {

				if (err) {
					console.log(err);
					done();
				} else {
					_this._saveThumbnailToS3(convertedImagePath, remoteImagePath, function(err) {
						if (err) console.log(err);
						done();
					});
				}

			});

		});
	});

	// perform thumbnailing in parallel.
	async.parallel(work, function(err, results) {
		callback(err);
	});

};

/**
 * Save the thumbnail to S3
 *
 * @param string convertedImagePath The local path to the image
 * @param string remoteImagePath The S3 path for the image
 * @param function callback The callback function
 */
Worker.prototype._saveThumbnailToS3 = function(convertedImagePath, remoteImagePath, callback) {
	this.saver.save(convertedImagePath, remoteImagePath, function(err) {
		fs.unlink(convertedImagePath, function() {
			callback(err);
		});
	});
};

/**
 * Generate a path for this thumbnail
 *
 * @param string original The original image path
 * @param string suffix The thumbnail suffix. e.g. "small"
 * @param string format The thumbnail format. e.g. "jpg". Optional.
 */
Worker.prototype._thumbnailKey = function(prefix, suffix, format) {
	return prefix + '_' + suffix + '.' + (format || 'jpg');
};

/**
 * Remove a job from the queue
 *
 * @param string handle The SQS message handle
 */
Worker.prototype._deleteJob = function(handle) {
	this.sqs.deleteMessage({QueueUrl: config.get('sqsQueueUrl'), ReceiptHandle: handle}, function(err, resp) {
		if (err) {
			console.log("error deleting thumbnail job " + handle, err);
			return;
		}
		console.log('deleted thumbnail job ' + handle);
	});
};

exports.Worker = Worker;
