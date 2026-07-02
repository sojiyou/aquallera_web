// src/services/EmailService.js - UPDATED VERSION WITH STATION DETAILS

import emailjs from '@emailjs/browser';

// EmailJS Configuration
const EMAILJS_SERVICE_ID = 'service_6q0e89w'; // Replace with your EmailJS service ID
const EMAILJS_TEMPLATE_ID_REJECTION = 'template_2rk5qyq'; // Replace with your rejection template ID
const EMAILJS_TEMPLATE_ID_ADMIN_INVITE = 'template_qf3c91h';
const EMAILJS_PUBLIC_KEY = 'fpu4u65UlHZOE96yR'; // Replace with your EmailJS public key

/**
 * Initialize EmailJS
 */
export const initializeEmailJS = () => {
  try {
    emailjs.init(EMAILJS_PUBLIC_KEY);
    console.log('✅ EmailJS initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ EmailJS initialization failed:', error);
    return false;
  }
};

/**
 * Test EmailJS connection
 */
export const testEmailJSConnection = async () => {
  try {
    console.log('Testing EmailJS connection...');
    console.log('Service ID:', EMAILJS_SERVICE_ID);
    console.log('Public Key:', EMAILJS_PUBLIC_KEY);

    // Try to send a test email to yourself
    const testParams = {
      to_email: 'test@example.com', // Replace with your test email
      subject: 'AQUA-LLERA Email Test',
      message: 'This is a test email from AQUA-LLERA platform.'
    };

    // Note: You'll need to create a simple test template in EmailJS first
    // await emailjs.send(EMAILJS_SERVICE_ID, 'test_template_id', testParams);

    console.log('✅ EmailJS connection test passed');
    return true;
  } catch (error) {
    console.error('❌ EmailJS connection test failed:', error);
    return false;
  }
};

/**
 * Send rejection email to water station
 * @param {Object} stationData - The station data including all registration details
 * @param {string} rejectionReason - Admin's detailed reason for rejection
 */
export const sendRejectionEmail = async (stationData, rejectionReason) => {
  try {
    console.log('📧 Preparing rejection email for:', stationData.email);

    // Validate required data
    if (!stationData || !stationData.email) {
      throw new Error('Station data or email is missing');
    }

    if (!rejectionReason || rejectionReason.trim() === '') {
      throw new Error('Rejection reason is required');
    }

    // Format the email parameters - THIS IS WHAT GETS SENT TO EMAILJS TEMPLATE
    const emailParams = {
      // Recipient
      to_email: stationData.email,
      to_name: stationData.ownerName || 'Water Station Owner',

      // Station Details
      station_name: stationData.stationName || 'N/A',
      owner_name: stationData.ownerName || 'N/A',
      business_permit: stationData.businessPermitNumber || 'N/A',

      // Contact Information
      station_email: stationData.email || 'N/A',
      station_phone: stationData.phone || 'N/A',

      // Location Details
      station_address: stationData.address || 'N/A',
      station_city: stationData.city || 'N/A',
      station_state: stationData.state || 'N/A',
      station_zipcode: stationData.zipCode || 'N/A',
      full_address: `${stationData.address || ''}, ${stationData.city || ''}, ${stationData.state || ''} ${stationData.zipCode || ''}`.trim(),

      // Business Information
      business_hours: `${stationData.businessHours?.open || 'N/A'} - ${stationData.businessHours?.close || 'N/A'}`,
      services_offered: stationData.serviceTypes?.join(', ') || 'N/A',
      delivery_radius: stationData.deliveryRadius ? `${stationData.deliveryRadius} km` : 'N/A',

      // Rejection Details
      rejection_reason: rejectionReason,
      rejection_date: new Date().toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),

      // Application Details
      registration_date: stationData.createdAt ? new Date(stationData.createdAt).toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }) : 'N/A',

      // Support Information
      support_email: 'support@aquallera.com',
      platform_name: 'AQUA-LLERA',

      // Current Year for footer
      current_year: new Date().getFullYear(),

      // Reapplication Link (you can make this dynamic)
      reapply_link: 'https://your-app-url.com/signup'
    };

    console.log('📧 Email parameters prepared:', {
      to: emailParams.to_email,
      station: emailParams.station_name,
      reason: emailParams.rejection_reason.substring(0, 50) + '...'
    });

    // Send email using EmailJS
    const response = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID_REJECTION,
      emailParams
    );

    console.log('✅ Rejection email sent successfully:', response);
    return {
      success: true,
      response: response,
      sentTo: stationData.email
    };

  } catch (error) {
    console.error('❌ Failed to send rejection email:', error);

    // Throw a more descriptive error
    if (error.text) {
      throw new Error(`Email sending failed: ${error.text}`);
    } else if (error.message) {
      throw new Error(`Email sending failed: ${error.message}`);
    } else {
      throw new Error('Email sending failed: Unknown error');
    }
  }
};

/**
 * Send admin invitation email with login credentials
 * @param {string} toEmail - New admin's email
 * @param {string} generatedPassword - Generated password
 * @param {string} invitedBy - Email of the admin who invited
 */
export const sendAdminInvitation = async (toEmail, generatedPassword, invitedBy) => {
  try {
    console.log('📧 Sending admin invitation to:', toEmail);

    const emailParams = {
      to_email: toEmail,
      to_name: toEmail.split('@')[0],
      admin_email: toEmail,
      admin_password: generatedPassword,
      login_url: `${window.location.origin}/admin`,
      invited_by: invitedBy || 'Super Admin',
      platform_name: 'AQUA-LLERA',
      support_email: 'support@aquallera.com',
      current_year: new Date().getFullYear()
    };

    const response = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID_ADMIN_INVITE,
      emailParams
    );

    console.log('✅ Admin invitation sent successfully:', response);
    return { success: true, response, sentTo: toEmail };

  } catch (error) {
    console.error('❌ Failed to send admin invitation:', error);
    if (error.text) throw new Error(`Email sending failed: ${error.text}`);
    else if (error.message) throw new Error(`Email sending failed: ${error.message}`);
    else throw new Error('Email sending failed: Unknown error');
  }
};

/**
 * Send approval email to water station (optional - for future use)
 */
export const sendApprovalEmail = async (stationData) => {
  try {
    console.log('📧 Preparing approval email for:', stationData.email);

    const emailParams = {
      to_email: stationData.email,
      to_name: stationData.ownerName,
      station_name: stationData.stationName,
      approval_date: new Date().toLocaleDateString('en-PH'),
      dashboard_link: 'https://your-app-url.com/dashboard',
      support_email: 'support@aquallera.com'
    };

    // You'll need to create an approval template in EmailJS
    const response = await emailjs.send(
      EMAILJS_SERVICE_ID,
      'template_approval', // Create this template in EmailJS
      emailParams
    );

    console.log('✅ Approval email sent successfully');
    return { success: true, response };

  } catch (error) {
    console.error('❌ Failed to send approval email:', error);
    throw error;
  }
};

// Initialize EmailJS when this module loads
initializeEmailJS();

export default {
  sendRejectionEmail,
  sendApprovalEmail,
  sendAdminInvitation,
  testEmailJSConnection,
  initializeEmailJS
};
