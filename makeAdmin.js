const mongoose = require('mongoose');
const User = require('./server/models/User');
require('dotenv').config();

/*
=====================================================
KABARAK SOKO
ADMIN ACCOUNT SETUP
=====================================================
*/

// CURRENT ADMIN ACCOUNT
const currentAdminEmail = 'admin@kabarak.ac.ke';

// NEW ADMIN LOGIN DETAILS
const newAdminEmail = 'abnertraders@gmail.com';
const newPassword = 'KabarakAdmin@2026';


// ==========================================
// UPDATE ADMIN ACCOUNT
// ==========================================

async function updateAdminAccount() {

    try {

        // ------------------------------------------
        // CHECK MONGODB URI
        // ------------------------------------------

        if (!process.env.MONGODB_URI) {

            console.error('');
            console.error('========================================');
            console.error('❌ MONGODB_URI IS MISSING');
            console.error('========================================');
            console.error('Check your .env file.');
            console.error('');

            process.exit(1);
        }


        // ------------------------------------------
        // CONNECT TO MONGODB
        // ------------------------------------------

        console.log('');
        console.log('Connecting to MongoDB...');

        await mongoose.connect(
            process.env.MONGODB_URI
        );

        console.log('✅ Connected to MongoDB.');
        console.log('');


        // ------------------------------------------
        // CHECK IF NEW EMAIL IS ALREADY IN USE
        // ------------------------------------------

        const existingNewEmailUser = await User.findOne({
            email: newAdminEmail.toLowerCase()
        });


        if (
            existingNewEmailUser &&
            existingNewEmailUser.email !== currentAdminEmail.toLowerCase()
        ) {

            console.error('');
            console.error('========================================');
            console.error('❌ EMAIL ALREADY IN USE');
            console.error('========================================');
            console.error(
                `The email ${newAdminEmail} already belongs to another account.`
            );
            console.error('');
            console.error(
                'We will not modify that account.'
            );
            console.error('');

            await mongoose.disconnect();

            process.exit(1);
        }


        // ------------------------------------------
        // FIND CURRENT ADMIN ACCOUNT
        // ------------------------------------------

        console.log(
            `Looking for current admin: ${currentAdminEmail}`
        );

        const user = await User.findOne({
            email: currentAdminEmail.toLowerCase()
        });


        // ------------------------------------------
        // CURRENT ACCOUNT NOT FOUND
        // ------------------------------------------

        if (!user) {

            console.error('');
            console.error('========================================');
            console.error('❌ CURRENT ADMIN ACCOUNT NOT FOUND');
            console.error('========================================');
            console.error(
                `No user exists with email: ${currentAdminEmail}`
            );
            console.error('');

            await mongoose.disconnect();

            process.exit(1);
        }


        // ------------------------------------------
        // CHANGE EMAIL
        // ------------------------------------------

        user.email = newAdminEmail.toLowerCase();


        // ------------------------------------------
        // SET NEW PASSWORD
        // ------------------------------------------
        //
        // User.js automatically hashes the password
        // through its pre-save hook.
        //
        // DO NOT bcrypt-hash it here.
        //
        // ------------------------------------------

        user.password = newPassword;


        // ------------------------------------------
        // MAKE SURE ACCOUNT IS ADMIN
        // ------------------------------------------

        user.isAdmin = true;


        // ------------------------------------------
        // SAVE ACCOUNT
        // ------------------------------------------

        await user.save();


        // ------------------------------------------
        // SUCCESS
        // ------------------------------------------

        console.log('');
        console.log('========================================');
        console.log('✅ ADMIN ACCOUNT UPDATED SUCCESSFULLY');
        console.log('========================================');
        console.log(`Name: ${user.name}`);
        console.log(`Old email: ${currentAdminEmail}`);
        console.log(`New email: ${user.email}`);
        console.log('Admin: YES');
        console.log(`New password: ${newPassword}`);
        console.log('========================================');
        console.log('');

        console.log(
            'The password was automatically hashed by User.js.'
        );

        console.log('');


        // ------------------------------------------
        // CLOSE DATABASE
        // ------------------------------------------

        await mongoose.disconnect();

        console.log('MongoDB connection closed.');
        console.log('');
        console.log('Admin login is now ready.');
        console.log('');

        process.exit(0);

    } catch (error) {

        console.error('');
        console.error('========================================');
        console.error('❌ ADMIN UPDATE FAILED');
        console.error('========================================');
        console.error(error.message);
        console.error('========================================');
        console.error('');

        try {
            await mongoose.disconnect();
        } catch (disconnectError) {
            // Ignore disconnect errors
        }

        process.exit(1);
    }
}


// ==========================================
// RUN
// ==========================================

updateAdminAccount();