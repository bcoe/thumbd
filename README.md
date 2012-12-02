Thumbd
------

Author: Benjamin Coe [@benjamincoe](https://twitter.com/benjamincoe)

Thumbd is an image thumbnailing server built on top of Node.js, SQS, S3, and ImageMagick.

Setup
=====

```
apt-get install imagemagick
npm install thumbd
```

Thumbd requires the following environment variables to be set:

* **AWS_KEY** the key for your AWS account (the IAM user must have access to the appropriate SQS and S3 resources).
* **AWS_SECRET** the AWS secret key.
* **BUCKET** the bucket to download the original images from. The thumbnails will also be placed in this bucket.
* **SQS_QUEUE** the queue to listen for image thumbnaling. Should be in the format `123456789/queue-name`.

You can export these variables to your environment, or specify them when running the thumbd CLI.

Personally, I set these environment variables in a .env file and execute thumbd using Foreman.

Server
======

The thumbd server:

* listens for thumbnailing jobs on the queue specified.
* downloads the original image from S3 to a temporary directory.
* Uses ImageMagick to perform a set of transformations on the image.
* uploads the thumbnails created back to S3, with the following naming convention: [original filename excluding extension]\_[thumbnail suffix].jpg
	
Assume that the following thumbnail job was received over SQS:

```json
{
	"original": "example.png",
	"descriptions: [
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

Thumbnail Descriptions
======================

The descriptions received in the thumbnail job describe the way in which thumbnails should be generated.

**description** accepts the following keys:

* **suffix** a suffix describing the thumbnail.
* **width** the width of the thumbnail.
* **height** the height of the thumbnail.
* **background** background color for matte.
* **strategy** indicate an approach for creating the thumbnail.
  * **matted (default)** maintain aspect ratio, places image on _width x height_ matte.
  * **bounded** maintain aspect ratio, don't place image on matte.

CLI
===

Starting the server:

```bash
thumbd server --aws_key=<key> --aws_secret=<secret> --tmp_dir=</tmp> --sqs_queue=<sqs queue name> --bucket=<s3 thumbnail bucket>
```

Manually submitting an SQS thumbnailing job (useful for testing purposes):

```bash
thumbd thumbnail --remote_image=<path to image in s3> --thumbnail_descriptions=<path to thumbnail description JSON file> --aws_key=<key> --aws_secret=<secret> --sqs_queue=<sqs queue name>
```

* **remote_image** indicates the S3 object to perform the thumbnailing operations on.
* **thumbnail_descriptions** the path to a JSON file describing the dimensions of the thumbnails that should be created (see _example.json_ in the _data_ directory).

The Future
==========

thumbd is a rough first pass at creating an efficient, easy to deploy, thumbnailing pipeline. I need thumbd for work, and will be actively contributing to this project.

Copyright
---------

Copyright (c) 2012 Attachments.me. See LICENSE.txt for further details.