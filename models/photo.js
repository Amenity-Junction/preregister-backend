const { Schema, model } = require('mongoose');

const photoSchema = new Schema({
	name: {
		type: String,
		required: true
	},
	value: {
		type: String,
		required: true
	},
	mimeType: {
		type: String,
		required: true
	}
});

const Photo = model('photo', photoSchema);

module.exports = Photo;
