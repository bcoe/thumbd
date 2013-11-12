Thumbd
======

Build Status: [![Build Status](https://travis-ci.org/bcoe/thumbd.png)](https://travis-ci.org/bcoe/thumbd)

Thumbd is an image thumbnailing server built on top of Node.js, SQS, S3, and ImageMagick.

You can easily run Thumbd on *Heroku*. Simply set the appropriate environment variables with _config:set_ and deploy using the _Procfile_ provided.

Setup
-----

```
apt-get install imagemagick
npm install thumbd
```

Thumbd requires the following environment variables to be set:

* **AWS_KEY** the key for your AWS account (the IAM user must have access to the appropriate SQS and S3 resources).
* **AWS_SECRET** the AWS secret key.
* **AWS_REGION** the AWS Region of the bucket. Defaults to: `us-east-1`.
* **BUCKET** the bucket to download the original images from. The thumbnails will also be placed in this bucket.
* **CONVERT_COMMAND** the ImageMagick convert command. Defaults to `convert`.
* **REQUEST_TIMEOUT** how long to wait in milliseconds before aborting a remote request. Defaults to `15000`.
* **S3_ACL** the acl to set on the uploaded images. Must be one of `private`, or `public-read`. Defaults to `private`.
* **S3_STORAGE_CLASS** the storage class for the uploaded images. Must be either `STANDARD` or `REDUCED_REDUNDANCY`. Defaults to `STANDARD`.
* **SQS_QUEUE** the queue name to listen for image thumbnailing.
	* As of version 2.0.0, the integer identifier from the queue URL is no longer required.

You can export these variables to your environment, or specify them when running the thumbd CLI.

Personally, I set these environment variables in a .env file and execute thumbd using Foreman.

Server
------

The thumbd server:

* listens for thumbnailing jobs on the queue specified.
* downloads the original image from our thumbnailng S3 bucket, or from an HTTP(s) resource.
	* HTTP resources are prefixed with __http://__ or __https://__.
	* S3 resources are a path to the image in the S3 bucket indicated by the __BUCKET__ environment variable.
* Uses ImageMagick to perform a set of transformations on the image.
* uploads the thumbnails created back to S3, with the following naming convention: [original filename excluding extension]\_[thumbnail suffix].jpg

Assume that the following thumbnail job was received over SQS:

```json
{
	"original": "example.png",
	"descriptions": [
		{
			"suffix": "tiny",
			"width": 48,
			"height": 48
		},
		{
			"suffix": "small",
			"width": 100,
			"height": 100,
			"background": "red"
		},
		{
			"suffix": "medium",
			"width": 150,
			"height": 150,
			"strategy": "bounded"
		}
	]
}
```

Once thumbd processes the job, the files stored in S3 will look something like this:

* **/example.png**
* **/example\_tiny.jpg**
* **/example\_small.jpg**
* **/example\_medium.jpg**

Client
------

Submit thumbnailing jobs from your application by creating an instance of a thumbd client (clients will soon be offered for other languages).

```javascript
var Client = require('./thumbd').Client,
	client = new Client({
		awsKey: 'AWS-KEY',
		awsSecret: 'AWS-SECRET',
		awsRegion: 'AWS-REGION',
		sqsQueue: 'thumbnailing-queue',
		s3Bucket: 'thumbnails'
	});

var destination = '/example/awesome.jpg';

client.upload('/tmp/awesome.jpg', destination, function(err) {
	if (err) throw err;
	client.thumbnail(destination, [{suffix: 'small', width: 100, height: 100, background: 'red', strategy: 'matted'}]);
});
```

Thumbnail Descriptions
----------------------

The descriptions received in the thumbnail job describe the way in which thumbnails should be generated.

_description_ accepts the following keys:

* **suffix** a suffix describing the thumbnail.
* **width** the width of the thumbnail.
* **height** the height of the thumbnail.
* **background** background color for matte.
* **format** what should the output format of the image be, e.g., `jpg`, `gif`, defaults to `jpg`.
* **strategy** indicate an approach for creating the thumbnail.
	* **matted** maintain aspect ratio, places image on _width x height_ matte.
	* **bounded (default)** maintain aspect ratio, don't place image on matte.
	* **fill** both resizes and zooms into an image, filling the specified dimensions.
* **quality** the quality of the thumbnail, in percent. e.g. `90`.

CLI
---

Starting the server:

```bash
thumbd server --aws_key=<key> --aws_secret=<secret> --sqs_queue=<sqs queue name> --bucket=<s3 thumbnail bucket> [--aws_region=<region>] [--tmp_dir=</tmp>] [--s3_acl=<private or public-read>] [--s3_storage_class=<STANDARD or REDUCED_REDUNDANCY>]
```

Manually submitting an SQS thumbnailing job (useful for testing purposes):

```bash
thumbd thumbnail --remote_image=<path to image s3 or http> --descriptions=<path to thumbnail description JSON file> --aws_key=<key> --aws_secret=<secret> --sqs_queue=<sqs queue name> [--aws_region=<region>]
```

* **remote_image** indicates the S3 object to perform the thumbnailing operations on.
* **thumbnail_descriptions** the path to a JSON file describing the dimensions of the thumbnails that should be created (see _example.json_ in the _data_ directory).

Production Notes
----------------

At Attachments.me, thumbd thumbnails tens of thousands of images a day. There are a few things you should know about our production deployment:

![Thumbd in Production](https://dl.dropboxusercontent.com/s/r2sce6tekfsvolt/thumbnailer.png?token_hash=AAHI0ARNhPdra24jqmDFpoC7nNiNTL8ELwOtaQB_YqVwpg "Thumbd in Production")

* thumbd was not designed to be bullet-proof:
	* it is run with an Upstart script, which keeps the thumbnailing process on its feet.
* Node.js is a single process, this does not take advantage of multi-processor environments.
	* we run an instance of thumbd per-CPU on our servers.
* we use Foreman's export functionality to simplify the process of creating Upstart scripts.
* be midful of the version of ImageMagick you are running:
	* make sure that you build it with the appropriate extensions for images you would like to support.
	* we've had issues with some versions of ImageMagick, we run 6.6.2-6 in production.
* Your SQS settings are important:
	* setup a visibility-timeout/message-retention value that allows for a reasonable number of thumbnailing attempts.
	* we use long-polling to reduce the latency time before a message is read.
* in production, thumbd runs on Node 0.8.x. It has not been thoroughly tested with Streams 2.

The Future
----------

thumbd is a rough first pass at creating an efficient, easy to deploy, thumbnailing pipeline. Please be liberal with your feature-requests, patches, and feedback.

Copyright
---------

Copyright (c) 2012 Attachments.me. See LICENSE.txt for further details.
