#!/usr/bin/env node

var thumbd = require('../lib'),
	_ = require('underscore'),
	fs = require('fs'),
	knox = require('knox'),
	argv = require('optimist').argv,
	mode = argv._.shift(),
	config = require('../lib/config').Config,
	serverOpts = {
		aws_key: 'awsKey',
		aws_secret: 'awsSecret',
		aws_region: 'awsRegion',
		bucket: 's3Bucket',
		convert_command: 'convertCommand',
		s3_acl: 's3Acl',
		s3_storage_class: 's3StorageClass',
		sqs_queue: 'sqsQueue',
		tmp_dir: 'tmpDir'
	},
	thumbnailOpts = {
		aws_key: 'awsKey',
		aws_secret: 'awsSecret',
		aws_region: 'awsRegion',
		descriptions: 'descriptions',
		remote_image: 'remoteImage',
		sqs_queue: 'sqsQueue'
	};

/**
 * Extract the command line parameters
 *
 * @param object keys A mapping of cli option => config key names
 *
 * @return object
 */
function buildOpts(keys) {
	var opts = {};
	var pairs = _.pairs(keys);
	for (var i in pairs) {
		var argvKey = pairs[i][0];
		var envKey = argvKey.toUpperCase();
		var configKey = pairs[i][1];
		opts[configKey] = argv[argvKey] || config.get(configKey);
		if (!opts[configKey]) {
			throw "The environment variable '" + envKey + "', or command line parameter '--" + argvKey + "' must be set.";
		}
	}
	return opts;
}

switch (mode) {
	case 'server':

		var opts = buildOpts(serverOpts);
		config.extend(opts);

		var knoxOpts = {
			key: config.get('awsKey'),
			secret: config.get('awsSecret'),
			bucket: config.get('s3Bucket')
		}

		// Knox wants 'us-standard' instead of 'us-east-1'
		if (config.get('awsRegion') == 'us-east-1') {
			knoxOpts.region = 'us-standard';
		}

		var s3 = knox.createClient(knoxOpts);

		var grabber = new thumbd.Grabber(s3);
		var saver = new thumbd.Saver(s3);
		var thumbnailer = new thumbd.Thumbnailer();

		(new thumbd.Worker({
			thumbnailer: thumbnailer,
			saver: saver,
			grabber: grabber
		})).start();
		break;

	case 'thumbnail':

		var opts = buildOpts(thumbnailOpts);
		config.extend(opts);

		// create a client for submitting
		// thumbnailing jobs.
		var client = new thumbd.Client();
		client.thumbnail(
			opts.remoteImage,
			JSON.parse(fs.readFileSync(opts.descriptions).toString()),
			function(err, res) {
				if (err) {
					console.log(err);
				} else {
					console.log(res);
				}
			}
		);
		break;
	default:
		console.log(
			"Usage: thumbd <command>\n\n",
			"where <command> is one of:\n",
			"\tthumbd server --aws_key=<key> --aws_secret=<secret> --tmp_dir=</tmp> --sqs_queue=<sqs queue name> --bucket=<s3 thumbnail bucket> --s3_acl=<private or public-read> --s3_storage_class=<STANDARD or REDUCED_REDUNDANCY>\n",
			"\tthumbd thumbnail --remote_image=<path to image s3 or http> --descriptions=<path to thumbnail description JSON file> --aws_key=<key> --aws_secret=<secret> --sqs_queue=<sqs queue name>\n"
		);
}
