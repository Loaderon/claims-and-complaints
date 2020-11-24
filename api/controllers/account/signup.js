module.exports = {
  inputs: {
    email: { required: true, type: 'string', isEmail: true, },
    password: { required: true, type: 'string', maxLength: 200, },
    fullName:  { required: true, type: 'string', }
  },

  exits: {
    success: {},
    invalid: { responseType: 'badRequest' },
    emailAlreadyInUse: { statusCode: 409, },
  },

  fn: async function ({email, password, fullName}) {
    var newUser = await module.exports.createUser(email, password, fullName, this.req.ip);
    await module.exports.sendEmailForAccountConfirmation(newUser);
  },

  createUser: async function (email, password, fullName, clientIp) {
    email = email.toLowerCase();
    emailConfirmationToken = sails.helpers.strings.random('url-friendly');
    emailConfirmationTokenExpiration = Date.now() + sails.config.custom.emailProofTokenTTL;
    password = await sails.helpers.passwords.hashPassword(password);

    return await User.create({ email: email, emailConfirmationToken: emailConfirmationToken,
      emailConfirmationTokenExpiration: emailConfirmationTokenExpiration,
      password: password, fullName: fullName, tosAcceptedByIp: clientIp})
    .intercept('E_UNIQUE', 'emailAlreadyInUse')
    .intercept({name: 'UsageError'}, 'invalid')
    .fetch();
  },

  sendEmailForAccountConfirmation: async function(newUser){
    let token = newUser.emailConfirmationToken;
    let url = require('url');
    let endpoint_url = url.resolve(sails.config.custom.baseUrl, '/confirm_email');
    let verificationURL = endpoint_url + '?token=' + encodeURIComponent(token);
    let emailTemplateData = { fullName: newUser.fullName, verificationURL: verificationURL, url: url };
    let emailTemplatePath = 'emails/verify-account';
    let htmlEmailContents = await sails.renderView(emailTemplatePath, emailTemplateData);
    await sails.helpers.sendMail(newUser.email, 'Please confirm your account', htmlEmailContents);
  },
};
