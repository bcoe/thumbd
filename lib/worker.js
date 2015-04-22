var _ = require('lodash'),
	aws = require('aws-sdk'),
	async = require('async'),
	config = require('./config').Config,
	fs = require('fs'),
	request = require('request'),
	Thumbnailer = require('./thumbnailer').Thumbnailer;

/**
 * Initialize the Worker
 *
 * @param object opts Worker configuration. Optional.
 */
function Worker(opts) {
	_.extend(this, {
		grabber: null,
		saver: null,
		logger: require('./logger')
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

	this.logger.info('wait for message on ' + config.get('sqsQueue'));

	this.sqs.receiveMessage( { QueueUrl: config.get('sqsQueueUrl'), MaxNumberOfMessages: 1 }, function (err, job) {
		if (err) {
			_this.logger.error(err);
			_this._nextJob();
			return;
		}

		if (!job.Messages || job.Messages.length === 0) {
			_this._nextJob();
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
			_this._nextJob();
		});
	});
};

/**
 * asynchronously enqueue reading the next thumbnail
 * job off of SQS.
 */
Worker.prototype._nextJob = function() {
	var _this = this;

	process.nextTick(function() {
		_this._processSQSMessage();
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

	// if the prefix is missing, default to the filename.
	if (!job.prefix) job.prefix = job.resources[0].split('.').slice(0, -1).join('.');

	var _this = this;

	async.waterfall([
		function(done) {
			async.mapLimit(job.resources, 5, function(resource, done) {
				_this._downloadFromS3(job.bucket, job.region, resource, done);
			}, done);
		},
		function(s3Downloads, done) {
			_this._createThumbnails(s3Downloads, job, function(err, uploadedFiles) {
				async.forEach(_.pluck(s3Downloads, 'localPath'), fs.unlink, function(errUnlink) {
					if (errUnlink) {
						_this.logger.warn("WARNING: failed to delete temporary file " + errUnlink.path);
					}
					done(err, uploadedFiles);
				});
			});
		},
		function(uploadedFiles, done) {
			job.output = uploadedFiles;
			_this._notify(job, done);
		}
	], function(err) {
		if (!err) _this._deleteJob(handle);
		else _this.logger.error(err.message);
		callback();
	});
};

/**
 * Download the image from S3
 *
 * @param string remoteImagePath The s3 path to the image
 * @param function callback The callback function
 */
Worker.prototype._downloadFromS3 = function(bucket, region, remoteImagePath, callback) {
	// allow a default bucket to be overridden.
	bucket = bucket || config.get('s3Bucket');
	region = region || config.get('awsRegion');

	this.grabber.download(bucket, region, remoteImagePath, function(err, localPath, metadata) {
		// Leave the job in the queue if an error occurs.
		if (err) return callback(err);
		callback(null, {localPath: localPath, metadata: metadata});
	});
};

/**
 * Create thumbnails for the image
 *
 * @param string localPath The local path to store the images
 * @param object job The job description
 * @param function callback The callback function
 */
Worker.prototype._createThumbnails = function(s3Downloads, job, callback) {
	var _this = this,
		localPaths = _.pluck(s3Downloads, 'localPath'),
		work = [],
		bucket = job.bucket || config.get('s3Bucket'),
		region = job.region || config.get('awsRegion');

	// Create thumbnailing work for each thumbnail description.
	job.descriptions.forEach(function(description) {
		work.push(function(done) {

			var remoteImagePath = _this._thumbnailKey(job.prefix, description.suffix, description.format);

			(new Thumbnailer()).execute(description, localPaths, function(err, convertedImagePath) {

				if (err) {
					_this.logger.error(err);
					done();
				} else {
					_this._saveThumbnailToS3(bucket, region, convertedImagePath, remoteImagePath, s3Downloads[0].metadata, function(err) {
						if (err) _this.logger.error(err);
						done(null, remoteImagePath);
					});
				}

			});

		});
	});

	// perform thumbnailing in parallel.
	async.parallel(work, callback);
};

/**
 * Save the thumbnail to S3
 *
 * @param string convertedImagePath The local path to the image
 * @param string remoteImagePath The S3 path for the image
 * @param function callback The callback function
 */
Worker.prototype._saveThumbnailToS3 = function(bucket, region, convertedImagePath, remoteImagePath, metadata, callback) {
	this.saver.save(bucket, region, convertedImagePath, remoteImagePath, metadata, function(err) {
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
	var _this = this;

	this.sqs.deleteMessage({QueueUrl: config.get('sqsQueueUrl'), ReceiptHandle: handle}, function(err, resp) {
		if (err) {
			_this.logger.error("error deleting thumbnail job " + handle, err);
			return;
		}
		_this.logger.info('deleted thumbnail job ' + handle);
	});
};

/**
 * Call notification url
 *
 * @param string job: the body of the SQS job.
 */
Worker.prototype._notify = function(job, cb) {
	var _this = this;

  if (!job.notify) return cb();

	var options = {
		method: "POST",
		url: job.notify,
		json: true,
		body: job
	};

	request.post(options, function(err) {
		if (!err) _this.logger.error('notified:', job.notify);
		return cb();
	});
};

exports.Worker = Worker;
