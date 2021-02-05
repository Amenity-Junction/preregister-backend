/** Amenity Junction Server */

require('dotenv').config();

const PORT = process.env.PORT ?? 5000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
	process.stderr.write('MONGO_URI not defined!\n');
	process.exit(1);
}

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');
const multer = require('multer');
const fs = require('fs-extra');
const path = require('path');
const mime = require('mime-types');
const { statusCode } = require('statushttp');
const imageToBase64 = require('image-to-base64');

const TMP_DIR = path.join(__dirname, 'tmp')
const IMG_DIR = path.join(__dirname, 'imgs')

if (!fs.existsSync(TMP_DIR))
	fs.mkdirSync(TMP_DIR);
if (!fs.existsSync(IMG_DIR))
	fs.mkdirSync(IMG_DIR);

const Member = require('./models/member');
const Photo = require('./models/photo');

const app = express();
const fileUpload = multer({
	dest: TMP_DIR,
	limits: {
		fileSize: 1048576 * 3
	}
});

app.use(cors());
app.use(express.json({ strict: false }));
app.use(express.urlencoded({ extended: false }));
app.use(morgan('dev'));

app.route('/images/:imgName')
.all(async (req, res) => {
	try {
		const photo = await Photo.findOne({ name: req.params.imgName });
		if (photo == null)
			return res.status(statusCode.NOT_FOUND).end();
		const encoded = photo.value;
		const buff = Buffer.from(encoded, 'base64');
		return res.status(statusCode.OK).contentType(photo.mimeType).send(buff);
	} catch (e) {
		console.log(e);
		return res.status(statusCode.INTERNAL_SERVER_ERROR).send('Failed to retrieve photo!');
	}
});

app.route('/')
.post(fileUpload.single('photo'), async (req, res) => {
	console.log(req.file);
	console.log(req.body);
	const { file: photo } = req;
	let img = null,
		imgName = null;
	if (photo != null) {
		const fileType = mime.lookup(photo.originalname);
		if (fileType?.substring(0, 5) !== 'image')
			return res.status(statusCode.BAD_REQUEST).send('Invalid photo!');
		const extension = path.extname(photo.originalname);
		imgName = photo.filename + extension;
		const tmpFile = path.join(TMP_DIR, photo.filename);
		const imgFile = path.join(IMG_DIR, imgName);
		fs.moveSync(tmpFile, imgFile);
		const imgb64 = /* `data:${fileType};base64,` + */ await imageToBase64(imgFile);
		fs.unlinkSync(imgFile);
		try {
			img = await Photo.create({
				name: imgName,
				value: imgb64,
				mimeType: fileType
			});
		} catch (e) {
			console.log(e);
			return res.status(statusCode.INTERNAL_SERVER_ERROR).send('Failed to upload photo!');
		}
	}
	let member = { ...req.body, photo: imgName };
	try {
		member.dob = new Date(member.dob);
	} catch (e) {
		console.log(e);
		return res.status(statusCode.BAD_REQUEST).send('Invalid date of birth!');
	}
	try {
		const newMember = await Member.create(member);
		return res.status(statusCode.OK).json(newMember);
	} catch (e) {
		console.log(e);
		return res.status(statusCode.INTERNAL_SERVER_ERROR).send('Failed to create member!');
	}
})
.get(async (req, res) => {
	if (!(req.body && req.header('access-password') === process.env.VIEW_PASS))
		return res.status(statusCode.UNAUTHORIZED).send('Wrong password!');
	try {
		const members = await Member.find({});
		return res.status(statusCode.OK).json(members);
	} catch (e) {
		console.log(e);
		return res.status(statusCode.INTERNAL_SERVER_ERROR).send('Failed to fetch members!');
	}
})
.delete(async (req, res) => {
	if (!(req.body && req.body === process.env.DEL_PASS))
		return res.status(statusCode.UNAUTHORIZED).send('Wrong password!');
	try {
		console.log(`Deleting records...`);
		const members = await Member.deleteMany({});
		const photos = await Photo.deleteMany({});
		fs.emptyDirSync(TMP_DIR);
		fs.emptyDirSync(IMG_DIR);
		return res.status(statusCode.OK).json(members);
	} catch (e) {
		console.log(e);
		return res.status(statusCode.INTERNAL_SERVER_ERROR).send('Failed to delete members!');
	}
});

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true })
	.then(() => {
		console.log(`Connected to MongoDB at ${MONGO_URI.replace(/:\/\/.+:.+@/, '******************')}.`);
		app.listen(PORT, () => console.log(`Listening on port ${PORT}.`))
	})
	.catch(() => {
		process.stderr.write(`Couldn't connect to MongoDB at ${MONGO_URI}!\n`);
		process.exit(1);
	});
