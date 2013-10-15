#!/usr/bin/env node

var thumbd = require('../lib'),
	fs = require('fs'),
	knox = require('knox'),
	argv = require('optimist').argv,
	mode = argv._.shift(),
	lastError = null,
	serverOpts = {
		aws_key: process.env.AWS_KEY,
		aws_secret: process.env.AWS_SECRET,
		s3_acl: (process.env.S3_ACL || 'private'),
		s3_storage_class: (process.env.S3_STORAGE_CLASS || 'STANDARD'),
		sqs_queue: process.env.SQS_QUEUE,
		bucket: process.env.BUCKET,
		tmp_dir: (process.env.tmp_dir || '/tmp'),
		convert_command: (process.env.convert_command || 'convert')
	},
	thumbnailOpts = {
		aws_key: process.env.AWS_KEY,
		aws_secret: process.env.AWS_SECRET,
		sqs_queue: process.env.SQS_QUEUE,
		descriptions: "./data/example.json",
		remote_image: null
	};

function buildOpts(opts) {
	Object.keys(opts).forEach(function(key) {
		opts[key] = argv[key] || opts[key];
		if (!opts[key]) {
			lastError = "the environment variable '" + key + "' must be set.";
		}
	});
	return opts;
};

switch (mode) {
	case 'server':
		
		var opts = buildOpts(serverOpts);
		
		if (!lastError) {

			var s3 = knox.createClient({
				key: opts.aws_key,
				secret: opts.aws_secret,
				bucket: opts.bucket
			});

			var grabber = new thumbd.Grabber({
				tmp_dir: opts.tmp_dir,
				s3: s3
			});

			var saver = new thumbd.Saver({
				s3: s3,
				s3_acl: opts.s3_acl,
				s3_storage_class: opts.s3_storage_class
			});

			var thumbnailer = new thumbd.Thumbnailer({
				tmp_dir: opts.tmp_dir,
				convert_command: opts.convert_command
			});

			(new thumbd.Worker({
				thumbnailer: thumbnailer,
				saver: saver,
				grabber: grabber,
				aws_key: opts.aws_key,
				aws_secret: opts.aws_secret,
				sqs_queue: opts.sqs_queue
			})).start();

		} else {
			console.log(lastError);
		}
		break;
	case 'thumbnail':
	
		var opts = buildOpts(thumbnailOpts);
		
		if (!lastError) {

			// create a client for submitting
			// thumbnailing jobs.
			var client = new thumbd.Client({
				awsKey: opts.aws_key,
				awsSecret: opts.aws_secret,
				sqsQueue: opts.sqs_queue
			});

			client.thumbnail(
				opts.remote_image,
				JSON.parse(fs.readFileSync(opts.descriptions).toString()),
				function(err, res) {
					if (err) {
						console.log(err);
					} else {
						console.log(res);
					}
				}
			);
			
		} else {
			console.log(lastError);
		}
		break;
	default:
		console.log(
			"Usage: thumbd <command>\n\n",
			"where <command> is one of:\n",
			"\tthumbd server --aws_key=<key> --aws_secret=<secret> --tmp_dir=</tmp> --sqs_queue=<sqs queue name> --bucket=<s3 thumbnail bucket> --s3_storage_class=<STANDARD or REDUCED_REDUNDANCY>\n",
			"\tthumbd thumbnail --remote_image=<path to image s3 or http> --descriptions=<path to thumbnail description JSON file> --aws_key=<key> --aws_secret=<secret> --sqs_queue=<sqs queue name>\n"
		)
}