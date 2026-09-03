const express = require('express');
const router = express.Router();
const axios = require('axios');
const Order = require('../models/Orders');
const auth = require('../middleware/auth');

// Helper: Get OAuth token from Safaricom
async function getAccessToken() {
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

  try {
    const response = await axios.get(
      'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      {
        headers: {
          Authorization: `Basic ${auth}`
        }
      }
    );
    return response.data.access_token;
  } catch (error) {
    console.error('M-Pesa token error:', error.response?.data || error.message);
    throw new Error('Failed to get M-Pesa access token');
  }
}

// POST /api/mpesa/stkpush – Initiate STK Push
router.post('/stkpush', auth, async (req, res) => {
  try {
    const { orderId, phoneNumber, amount } = req.body;

    if (!orderId || !phoneNumber || !amount) {
      return res.status(400).json({ message: 'orderId, phoneNumber and amount are required' });
    }

    // Validate phone number (format 2547XXXXXXXX)
    const formattedPhone = phoneNumber.replace(/\s/g, '').replace(/^0/, '254');
    if (!/^2547\d{8}$/.test(formattedPhone)) {
      return res.status(400).json({ message: 'Invalid phone number. Use format 07XXXXXXXX or 2547XXXXXXXX' });
    }

    // Get the order to verify it exists and get the user
    const order = await Order.findOne({ _id: orderId, userId: req.user._id });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Ensure order is still pending
    if (order.status !== 'pending' && order.status !== 'confirmed') {
      return res.status(400).json({ message: 'Order cannot be paid for' });
    }

    const token = await getAccessToken();

    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const passkey = process.env.MPESA_PASSKEY;
    const shortcode = process.env.MPESA_SHORTCODE;
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

    const callbackUrl = process.env.MPESA_CALLBACK_URL || 'http://localhost:5000/api/mpesa/callback';

    const payload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(amount), // Ensure integer
      PartyA: formattedPhone,
      PartyB: shortcode,
      PhoneNumber: formattedPhone,
      CallBackURL: callbackUrl,
      AccountReference: orderId,
      TransactionDesc: `Payment for order ${orderId}`
    };

    const response = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Save checkout request ID for later reference
    const checkoutRequestId = response.data.CheckoutRequestID;
    order.checkoutRequestId = checkoutRequestId;
    await order.save();

    res.json({
      success: true,
      message: 'STK Push sent successfully',
      checkoutRequestId,
      responseCode: response.data.ResponseCode,
      responseDescription: response.data.ResponseDescription
    });

  } catch (error) {
    console.error('STK Push error:', error.response?.data || error.message);
    res.status(500).json({
      message: 'Failed to initiate M-Pesa payment',
      error: error.response?.data?.errorMessage || error.message
    });
  }
});

// POST /api/mpesa/callback – Handle Safaricom callback
router.post('/callback', async (req, res) => {
  try {
    const callbackData = req.body;
    console.log('M-Pesa Callback received:', JSON.stringify(callbackData, null, 2));

    // Extract result from callback
    const result = callbackData.Body?.stkCallback;
    if (!result) {
      console.error('Invalid callback structure');
      return res.status(400).json({ message: 'Invalid callback' });
    }

    const { ResultCode, ResultDesc, CheckoutRequestID, CallbackMetadata } = result;

    // Find the order by checkoutRequestId
    const order = await Order.findOne({ checkoutRequestId: CheckoutRequestID });
    if (!order) {
      console.error(`Order not found for CheckoutRequestID: ${CheckoutRequestID}`);
      return res.status(404).json({ message: 'Order not found' });
    }

    if (ResultCode === 0) {
      // Payment successful
      // Extract M-Pesa Receipt Number from metadata
      const metadata = CallbackMetadata?.Item || [];
      const receiptItem = metadata.find(item => item.Name === 'MpesaReceiptNumber');
      const mpesaReceipt = receiptItem ? receiptItem.Value : '';

      // Update order status to paid and store receipt
      order.status = 'paid';
      order.mpesaReceipt = mpesaReceipt;
      order.updatedAt = new Date();

      // Update timeline – add paid step
      const paidStep = order.statusTimeline.find(step => step.label === 'Paid');
      if (paidStep) {
        paidStep.completed = true;
        paidStep.current = true;
      } else {
        order.statusTimeline.push({
          label: 'Paid',
          description: `Payment received via M-Pesa (Receipt: ${mpesaReceipt})`,
          completed: true,
          current: true
        });
      }

      await order.save();

      console.log(`✅ Order ${order._id} marked as paid. Receipt: ${mpesaReceipt}`);

      // Optional: Send email confirmation (we'll add later)

    } else {
      // Payment failed
      order.status = 'cancelled';
      order.updatedAt = new Date();
      // Add note to timeline
      order.statusTimeline.push({
        label: 'Payment Failed',
        description: `M-Pesa payment failed: ${ResultDesc}`,
        completed: true,
        current: true
      });
      await order.save();

      console.log(`❌ Order ${order._id} payment failed: ${ResultDesc}`);
    }

    // Respond to Safaricom (they expect a 200 OK with no body, or a simple response)
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });

  } catch (error) {
    console.error('M-Pesa callback error:', error);
    // Still return 200 to avoid retries
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });
  }
});

module.exports = router;