const { Schema, model } = require('mongoose');

const memberSchema = new Schema({
	name: {
		type: String,
		required: true
	},
	address: {
		type: String,
		required: true
	},
	phone: {
		type: String,
		required: true
	},
	aadhaar: {
		type: String,
		required: true
	},
	occupation: {
		type: String,
		required: true
	},
	dob: {
		type: Date,
		required: true
	},
	photo: {
		type: String,
		default: null
	},
	exp: {
		type: Number,
		required: true
	}
});

const Member = model('member', memberSchema);

module.exports = Member;
