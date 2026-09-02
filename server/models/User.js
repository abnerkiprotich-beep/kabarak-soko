const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true,
        trim: true
    },

    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },

    password: {
        type: String,
        required: true,
        minlength: 6
    },

    phone: {
        type: String,
        default: ''
    },

    address: {
        type: String,
        default: ''
    },

    isAdmin: {
        type: Boolean,
        default: false
    }

}, {
    timestamps: true
});


// ==========================================
// HASH PASSWORD BEFORE SAVING
// ==========================================

userSchema.pre('save', async function() {

    // If password has not changed, do nothing
    if (!this.isModified('password')) {
        return;
    }

    // Hash the password
    this.password = await bcrypt.hash(
        this.password,
        10
    );
});


// ==========================================
// COMPARE PASSWORD
// ==========================================

userSchema.methods.comparePassword = async function(candidate) {

    return await bcrypt.compare(
        candidate,
        this.password
    );

};


// ==========================================
// EXPORT MODEL
// ==========================================

module.exports = mongoose.model(
    'User',
    userSchema
);