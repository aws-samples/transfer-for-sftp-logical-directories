// Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.

// Permission is hereby granted, free of charge, to any person obtaining a copy of
// this software and associated documentation files (the "Software"), to deal in
// the Software without restriction, including without limitation the rights to
// use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
// the Software, and to permit persons to whom the Software is furnished to do so.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
// FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
// COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
// IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
// CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

/**
 * The following lambda performs 2 functions.  The first authorizes a user based on
 * a very simple in-memory database (see `userDb` below).  The second function is to 
 * craft a scope down policy for the specific user to restrict what the user can 
 * access via SFTP.  The scope down policy is overlayed atop the more generic user 
 * role which is passed to the Lambda as an environment variable.  The scope down
 * policy will restrict users to their particular home directory and give them read
 * access to those allowDirectories to which they've subscribed.
 */

var __version__ = '0.1';

// GetUserConfig Lambda
var public_bucket = process.env.PUBLIC_BUCKET;
var subscription_bucket = process.env.SUBSCRIBE_BUCKET;
var userRoleArn = process.env.USER_ROLE;
var sftpServerId = process.env.SERVER_ID;

var userDb = {
    "alice": {
        "password": "Password01",
        "policy": {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Sid": "AllowListingOfFolder",
                    "Action": [
                        "s3:ListBucket"
                    ],
                    "Effect": "Allow",
                    "Resource": [
                        "arn:aws:s3:::" + public_bucket,
                        "arn:aws:s3:::" + subscription_bucket
                    ]
                },
                {
                    "Sid": "AllowObjectAccess",
                    "Effect": "Allow",
                    "Action": [
                        "s3:GetObject",
                        "s3:GetObjectVersion"
                    ],
                    "Resource": [
                        "arn:aws:s3:::" + public_bucket + "/global/*",
                        "arn:aws:s3:::" + subscription_bucket + "/historical/2018/indices/*",
                        "arn:aws:s3:::" + subscription_bucket + "/historical/2019/indices/*",
                        "arn:aws:s3:::" + subscription_bucket + "/historical/2019/equities/*"
                    ]
                }
            ]
        },
        "directoryMap": [
            {
                "Entry": "/public/research",
                "Target": "/"+ public_bucket
            },
            {
                "Entry": "/subscribed/2018/indices",
                "Target": "/"+ subscription_bucket + "/historical/2018/indices"
            },
            {
                "Entry": "/subscribed/2019/indices",
                "Target": "/"+ subscription_bucket + "/historical/2019/indices"
            },
            {
                "Entry": "/subscribed/2019/equities",
                "Target": "/"+ subscription_bucket + "/historical/2019/equities"
            }
        ]
    },
    "bryan": {
        "password": "Password02",
        "policy": {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Sid": "AllowListingOfFolder",
                    "Action": [
                        "s3:ListBucket"
                    ],
                    "Effect": "Allow",
                    "Resource": [
                        "arn:aws:s3:::" + public_bucket,
                        "arn:aws:s3:::" + subscription_bucket
                    ]
                },
                {
                    "Sid": "AllowObjectAccess",
                    "Effect": "Allow",
                    "Action": [
                        "s3:GetObject",
                        "s3:GetObjectVersion"
                    ],
                    "Resource": [
                        "arn:aws:s3:::" + public_bucket + "/global/*",
                        "arn:aws:s3:::" + subscription_bucket + "/historical/2018/indices/*",
                        "arn:aws:s3:::" + subscription_bucket + "/historical/2018/equities/*",
                        "arn:aws:s3:::" + subscription_bucket + "/historical/2019/credit/*",
                        "arn:aws:s3:::" + subscription_bucket + "/historical/2019/equities/*"
                    ]
                }
            ]
        },
        "directoryMap": [
            {
                "Entry": "/public/research",
                "Target": "/"+ public_bucket
            },
            {
                "Entry": "/subscribed/2018/indices",
                "Target": "/"+ subscription_bucket + "/historical/2018/indices"
            },
            {
                "Entry": "/subscribed/2018/equities",
                "Target": "/"+ subscription_bucket + "/historical/2018/equities"
            },
            {
                "Entry": "/subscribed/2019/credit",
                "Target": "/"+ subscription_bucket + "/historical/2019/credit"
            },
            {
                "Entry": "/subscribed/2019/equities",
                "Target": "/"+ subscription_bucket + "/historical/2019/equities"
            }
        ]
    }
};

function authenticated(username, password) {
    if (username in userDb) {
        var userRecord = userDb[username];

        if (password == userRecord.password) {
            return true;
        }
    }

    return false;
}

function getDirectoryMapping(username) {
    var userRecord = userDb[username];
    return userRecord.directoryMap;
}

function getScopeDownPolicy(username) {
    var userRecord = userDb[username];
    return userRecord.policy;
}

exports.handler = (event, context, callback) => {
    console.log("Event:", JSON.stringify(event));

    var response = {};

    if (authenticated(event.username, event.password)) {
        var scopeDownPolicy = getScopeDownPolicy(event.username);
        var directoryMapping = getDirectoryMapping(event.username);

        response = {
            Role: userRoleArn,
            Policy: JSON.stringify(scopeDownPolicy),
            HomeDirectoryType: "LOGICAL",
            HomeDirectoryDetails: JSON.stringify(directoryMapping)
        };
    }

    console.log("Returning ", JSON.stringify(response));
    callback(null, response);
};
