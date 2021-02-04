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

const TMP_DIR = path.join(__dirname, 'tmp')
const IMG_DIR = path.join(__dirname, 'imgs')

if (!fs.existsSync(TMP_DIR))
	fs.mkdirSync(TMP_DIR);
if (!fs.existsSync(IMG_DIR))
	fs.mkdirSync(IMG_DIR);

const Member = require('./models/member');

const app = express();
const fileUpload = multer({
	dest: TMP_DIR,
	limits: {
		fileSize: 10485760
	}
});

app.use(cors());
app.use(express.json({ strict: false }));
app.use(express.urlencoded({ extended: false }));
app.use(morgan('dev'));

app.use('/images', express.static(IMG_DIR));
app.route('/')
.post(fileUpload.single('photo'), async (req, res) => {
	console.log(req.file);
	console.log(req.body);
	const { file: photo } = req;
	let img = null;
	if (photo != null) {
		const fileType = mime.lookup(photo.originalname)?.substring(0, 5);
		if (fileType !== 'image')
			return res.status(statusCode.BAD_REQUEST).send('Invalid photo!');
		const extension = path.extname(photo.originalname);
		img = photo.filename + extension;
		fs.copyFileSync(path.join(TMP_DIR, photo.filename), path.join(IMG_DIR, img));
	}
	let member = { ...req.body, photo: img };
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
