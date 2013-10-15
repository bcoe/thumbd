var aws = require('aws-sdk'),
	_ = require('underscore'),
	Grabber = require('./grabber').Grabber,
	Thumbnailer = require('./thumbnailer').Thumbnailer,
	Saver = require('./saver').Saver,
	fs = require('fs'),
	async = require('async');

function Worker(opts) {
	_.extend(this, {
		thumbnailer: null,
		grabber: null,
		saver: null,
		aws_key: process.env.AWS_KEY,
		aws_secret: process.env.AWS_SECRET,
		aws_region: process.env.AWS_REGION || "us-east-1",
		sqs_queue: process.env.SQS_QUEUE
	}, opts);

    this.sqs = new aws.SQS({
        accessKeyId: this.aws_key,
        secretAccessKey: this.aws_secret,
        region: this.aws_region
    });

    this.sqs_queue_url = this.sqs.endpoint.protocol + '//' + this.sqs.endpoint.hostname + '/' + this.sqs_queue;
}

Worker.prototype.start = function() {
	this._processSQSMessage();
};

Worker.prototype._processSQSMessage = function() {
	var _this = this;

	console.log('wait for message on ' + _this.sqs_queue);

	this.sqs.receiveMessage( { QueueUrl: this.sqs_queue_url, MaxNumberOfMessages: 1 }, function (err, job) {
		if (err) {
			console.log(err);
			_this._processSQSMessage();
			return;
		}

		if (!job.Messages || job.Messages.length == 0) {
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
				throw e;
			}
		}

		_this._runJob(handle, body, function() {
			_this._processSQSMessage();
		});
	});
};

Worker.prototype._runJob = function(handle, job, callback) {
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
	var _this = this;

	this._downloadFromS3(job.original, function(err, localPath) {

		if (err) {
			console.log(err);
			callback();
			return;
		}

		_this._createThumbnails(localPath, job, function(err) {
			fs.unlink(localPath, function() {
				if (!err) {
					_this._deleteJob(handle);
				}
				callback();
			});
		});

	});
};

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

Worker.prototype._createThumbnails = function(localPath, job, callback) {

	var _this = this,
		work = [];

	// Create thumbnailing work for each thumbnail description.
	job.descriptions.forEach(function(description) {
		work.push(function(done) {

			var remoteImagePath = _this._thumbnailKey(job.original, description.suffix, description.format),
				thumbnailer = new Thumbnailer({
					tmp_dir: _this.thumbnailer.tmp_dir,
					convert_command: _this.thumbnailer.convert_command
				});

			thumbnailer.execute(description, localPath, function(err, convertedImagePath) {

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

Worker.prototype._saveThumbnailToS3 = function(convertedImagePath, remoteImagePath, callback) {
	this.saver.save(convertedImagePath, remoteImagePath, function(err) {
		fs.unlink(convertedImagePath, function() {
			callback(err);
		});
	});
};

Worker.prototype._thumbnailKey = function(original, suffix, format) {
	var extension = original.split('.').pop(),
		prefix = original.split('.').slice(0, -1).join('.');

	return prefix + '_' + suffix + '.' + (format || 'jpg');
};

Worker.prototype._deleteJob = function(handle) {
	this.sqs.deleteMessage({QueueUrl: this.sqs_queue_url, ReceiptHandle: handle}, function(err, resp) {
		console.log('deleted thumbnail job ' + handle);
	});
};

exports.Worker = Worker;
