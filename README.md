Thumbd
======

**Deprecation Warning: this project is no longer actively maintained, and is left here
as a historical artifact. Please feel free to fork this project and take over maintenance.** 

[![Coverage Status](https://coveralls.io/repos/bcoe/thumbd/badge.svg?branch=)](https://coveralls.io/r/bcoe/thumbd?branch=)
[![Build Status](https://travis-ci.org/bcoe/thumbd.png)](https://travis-ci.org/bcoe/thumbd)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](https://github.com/feross/standard)

Thumbd is an image thumbnailing server built on top of Node.js, SQS, S3, and ImageMagick.

You can easily run Thumbd on *Heroku*. Simply set the appropriate environment variables with _config:set_ and deploy using the _Procfile_ provided.

Note: Creating video thumbnails on Heroku requires use of custom [ffmpeg](https://github.com/shunjikonishi/heroku-buildpack-ffmpeg) buildpack. Please refer to [Heroku deployment guide](https://github.com/bcoe/thumbd/wiki/Running-Thumbd-on-Heroku) in Wiki.

Setup
-----

```
apt-get install imagemagick
npm install thumbd
```

To install thumbd as a service:

```
npm install thumbd -g
thumbd install
thumbd start
```

Thumbd requires the following environment variables to be set:

* **AWS_KEY** the key for your AWS account (the IAM user must have access to the appropriate SQS and S3 resources).
* **AWS_SECRET** the AWS secret key.
* **BUCKET** the bucket to download the original images from. The thumbnails will also be placed in this bucket.
* **AWS_REGION** the AWS Region of the bucket. Defaults to: `us-east-1`.
* **CONVERT_COMMAND** the ImageMagick convert command. Defaults to `convert`.
* **REQUEST_TIMEOUT** how long to wait in milliseconds before aborting a remote request. Defaults to `15000`.
* **S3_ACL** the acl to set on the uploaded images. Must be one of `private`, or `public-read`. Defaults to `private`.
* **S3_STORAGE_CLASS** the storage class for the uploaded images. Must be either `STANDARD` or `REDUCED_REDUNDANCY`. Defaults to `STANDARD`.
* **SQS_QUEUE** the queue name to listen for image thumbnailing.

When running locally, I set these environment variables in a .env file and execute thumbd using Foreman.

Additionally, the following environment variable can be set to use a custom logger:

**LOGGER_FILE** the path to a javascript file that exports the `info`, `warn` and `error` methods.

Server
------

The thumbd server:

* listens for thumbnailing jobs on the queue specified.
* downloads the original image from our thumbnailng S3 bucket, or from an HTTP(s) resource.
	* HTTP resources are prefixed with `http://` or `https://`.
	* S3 resources are a path to the image in the S3 bucket indicated by the `BUCKET` environment variable.
* Uses ImageMagick to perform a set of transformations on the image.
* uploads the thumbnails created back to S3, with the following naming convention: `[original filename excluding extension]_[thumbnail suffix].[thumbnail format]`

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

Submit thumbnailing jobs from your application by creating an instance of a thumbd client (contribute by submitting clients in other languages).

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
	client.thumbnail(destination, [{suffix: 'small', width: 100, height: 100, background: 'red', strategy: 'matted'}], {
		notify: 'https://callback.example.com', // optional web-hook when processing is done.
		prefix: 'foobar' // optional prefix for thumbnails created.
	});
});
```

**Thumbnailing options:**

* **originalImagePaths:** `string` or `array`, path to image or images that thumbnailing should be applied to.
* **thumbnailDescriptions:** `array` describing the thumbnails that should be created.
* **opts:** additional thumbnailing options.
	* **notify:** webhook to notify when thumbnailing is complete.
	* **prefix:** prefix for thumbnails created (defaults to original filename).
	* **bucket:** bucket to download image from (defaults to server's default bucket).
	* **region:** aws-region to download image from (defaults to server's default region).

Thumbnail Descriptions
----------------------

The descriptions received in the thumbnail job describe the way in which thumbnails should be generated.

_description_ accepts the following keys:

* **suffix:** a suffix describing the thumbnail.
* **width:** the width of the thumbnail.
* **height:** the height of the thumbnail.
* **background:** background color for matte.
* **format:** what should the output format of the image be, e.g., `jpg`, `gif`, defaults to `jpg`.
* **strategy:** indicate an approach for creating the thumbnail.
	* **bounded (default):** maintain aspect ratio, don't place image on matte.
	* **matted:** maintain aspect ratio, places image on _width x height_ matte.
	* **fill:** both resizes and zooms into an image, filling the specified dimensions.
	* **strict:** resizes the image, filling the specified dimensions changing the aspect ratio
	* **manual:** allows for a custom convert command to be passed in:
	  * `%(command)s -border 0 %(localPaths[0])s %(convertedPath)s`
* **quality:** the quality of the thumbnail, in percent. e.g. `90`.
* **autoOrient:** true/false, whether to automatically rotate the photo based on EXIF data (for correcting orientation on phone images, etc)

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

Advanced Tips and Tricks
----------------

* **Creating a Mosaic:** Rather than performing an operation on a single S3 resource, you can perform an operation on a set
of S3 resources. A great example of this would be converting a set of images into a mosaic:

```json
{
	"resources": [
		"images/image1.png",
		"images/image2.png"
	],
	"descriptions": [{
		"strategy": "%(command)s -border 0 -tile 2x1 -geometry 160x106 '%(localPaths[0])s' '%(localPaths[1])s' %(convertedPath)s",
		"command": "montage",
		"suffix": "stitch"
	}]
}
```

**Creating Video Thumbnails on Heroku**

Creating video thumbnails on Heroku requires using custom buildpack. In short :

* install the [ffmpeg](https://github.com/shunjikonishi/heroku-buildpack-ffmpeg) custom buildpack.
* use a custom strategy that utilizes `ffmpeg` for thumbnail generation, rather than `convert`.

For detailed instructions, please refer to [Heroku deployment guide](https://github.com/bcoe/thumbd/wiki/Running-Thumbd-on-Heroku) in Wiki.

The custom strategy can be used for a variety of purposes, _experiment with it :tm:_

Production Notes
----------------

At Attachments.me, thumbd thumbnailed tens of thousands of images a day. There are a few things you should know about our production deployment:

![Thumbd in Production](https://dl.dropboxusercontent.com/s/r2sce6tekfsvolt/thumbnailer.png?token_hash=AAHI0ARNhPdra24jqmDFpoC7nNiNTL8ELwOtaQB_YqVwpg "Thumbd in Production")

* thumbd was not designed to be bullet-proof:
	* it is run with an Upstart script, which keeps the thumbnailing process on its feet.
* Node.js is a single process, this does not take advantage of multi-processor environments.
	* we run an instance of thumbd per-CPU on our servers.
* be mindful of the version of ImageMagick you are running:
	* make sure that you build it with the appropriate extensions for images you would like to support.
	* we've had issues with some versions of ImageMagick, we run 6.6.2-6 in production.
* Your SQS settings are important:
	* setup a visibility-timeout/message-retention value that allows for a reasonable number of thumbnailing attempts.
	* we use long-polling to reduce the latency time before a message is read.
* in production, thumbd runs on Node 0.8.x. It has not been thoroughly tested with Streams 2.

Projects Using Thumbd
--------------------

**If you build something cool using thumbd let me know, I will list it here.**

* **[Popbasic](https://popbasic.com)**: designs limited edition, high quality clothing.
* **[ineffable](https://github.com/taeram/ineffable/):** A minimalist photo album powered by Flask and React.
* **[s3-gif](https://github.com/taeram/s3-gif):** Host your GIF collection on Heroku + Amazon S3.
* **[talent-off](http://talentooff.com.br/):** Online contest for sports videos.
* **attachments.me**: created a searchable, visual, index of all of your email attachments (sadly defunct).

Copyright
---------

Copyright (c) 2015 Contributors, See LICENSE.txt for further details.
