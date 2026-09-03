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

    role: {
  type: String,
  enum: ['customer', 'seller', 'admin'],
  default: 'customer'
},
storeId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Store',
  default: null
},

    address: {
        type: String,
        default: ''
    },

      isAdmin: {
    type: Boolean,
    default: false
  },
  resetPasswordToken: { type: String, default: null },
  // Add to userSchema
isAffiliate: {
  type: Boolean,
  default: false
},
affiliateCode: {
  type: String,
  unique: true,
  sparse: true
},
referredBy: {
  type: String, // stores the affiliate code of the referrer
  default: null
},
commissionBalance: {
  type: Number,
  default: 0
},
totalEarned: {
  type: Number,
  default: 0
},
affiliateAppliedAt: {
  type: Date,
  default: null
},  
  resetPasswordToken: { type: String, default:null },
  resetPasswordExpires: { type: Date, default: null }
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