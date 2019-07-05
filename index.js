const fs = require('fs');
const AWS = require('aws-sdk');
const im = require('imagemagick');
const path = require('path');

const S3 = new AWS.S3({
    region: process.env.REKOG_REGION,
    apiVersion: '2006-03-01'
});

const rekognition = new AWS.Rekognition({
    apiVersion: '2016-06-27',
    'region': process.env.REKOG_REGION
});

exports.handler = async (event) => {
    let faces = await cropFaces(event);
    return faces;
};

async function cropFaces(event) {
    try {
        let file_name = await getS3filename(event);
        let filePath = await saveS3File(file_name);
        let fileProperty = await getImageProperty(filePath);
        let faceBoxes = await getBoundingBoxes(file_name);
        let crop_faces = await cropBoundingBoxes(file_name, filePath, faceBoxes, fileProperty);

        console.log('head: ' + JSON.stringify(faceBoxes));

        return true;
    } catch (error) {
        return error;
    }
}

const uploadFile = (filePath, bucketName, key) => {
    fs.readFile(filePath, (err, data) => {
        if (err) console.error(err);

        var base64data = new Buffer(data, 'binary');

        var params = {
            Bucket: bucketName,
            Key: key,
            Body: base64data
        };

        S3.upload(params, (err, data) => {
            if (err) console.error(`Upload Error ${err}`);
            console.log('Upload Completed');
        });
    });
};


function cropBoundingBoxes(file_name, filePath, faceBoxes, fileProperty) {
    return new Promise((resolve) => {

        const imgWidth = fileProperty.width;
        const imgHeight = fileProperty.height;

        console.log(imgWidth, imgHeight);

        var faceCount = 1;
        faceBoxes.forEach(function (face) {
            var box = face.BoundingBox;

            var box_width = (box.Width * imgWidth).toFixed();
            var box_height = (box.Height * imgHeight).toFixed();

            var box_x = (box.Left * imgWidth).toFixed();
            var box_y = (box.Top * imgHeight).toFixed();

            console.log('face face');
            console.log(box_width, box_height, box_x, box_y);

            var faceFile = '/tmp/' + faceCount + '-' + file_name.replace('/', '_');
            var key = 'faces/' + path.parse(file_name).name + '/' + faceCount + path.extname(file_name);

            console.log(faceFile, key);

            var args = [
                filePath,
                "-crop",
                box_width + 'x' + box_height + '+' + box_x + '+' + box_y,
                faceFile
            ];

            im.convert(args, function (err, stdout) {
                if (err) throw err;
                console.log('stdout:', stdout);

                uploadFile(faceFile, process.env.SG_BUCKET, key);
            });

            faceCount++;
        });


    });
}

function saveS3File(file_name) {

    return new Promise((resolve) => {
        var params = {
            Bucket: process.env.SG_BUCKET,
            Key: file_name
        };

        S3.getObject(params, function (err, data) {
            if (err) console.log(err, err.stack); // an error occurred
            var filePath = '/tmp/' + path.parse(file_name).name + path.extname(file_name);
            fs.writeFileSync(filePath, data.Body);
            resolve(filePath);
        });
    });
}

function getBoundingBoxes(file_name) {
    console.log("find face for : " + file_name);
    var params = {
        Image: {
            S3Object: {
                Bucket: process.env.SG_BUCKET,
                Name: file_name
            }
        }
    };

    return new Promise((resolve) => {
        rekognition.detectFaces(params, function (err, data) {
            if (err) console.log(err, err.stack); // an error occurred
            console.log('getBoundingBoxes: ' + JSON.stringify(data));
            if (data.FaceDetails) {
                resolve(data.FaceDetails);
            }
            resolve(null);
        });
    });
}

function getS3filename(event) {
    return new Promise((resolve) => {
        event.Records.forEach((element) => {
            var str_message = element.Sns.Message;
            if (str_message != '') {
                var str_object = JSON.parse(str_message);
                str_object.Records.forEach(function (item) {
                    var file_name = item.s3.object.key;
                    resolve(file_name);
                    console.log("inSide getS3filename: " + JSON.stringify(item.s3));
                });
            }
        });
    });
}

function getImageProperty(filePath) {
    return new Promise((resolve) => {
        im.identify(filePath, function (err, features) {
            if (err) console.log(err, err.stack); // an error occurred
            resolve(features);
        });
    });
}