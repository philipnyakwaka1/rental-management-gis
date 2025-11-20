// Minimal password policy module — exposes window.PasswordPolicy
(function(){
  const policy = {
    length: { test: pw => typeof pw === 'string' && pw.length >= 8, text: 'At least 8 characters' },
    uppercase: { test: pw => /[A-Z]/.test(pw), text: 'At least one uppercase letter' },
    number: { test: pw => /[0-9]/.test(pw), text: 'At least one number' },
    special: { test: pw => /[^A-Za-z0-9]/.test(pw), text: 'At least one special character' }
  };

  function validate(password){
    const results = {};
    Object.keys(policy).forEach(k => { results[k] = !!policy[k].test(password); });
    return results;
  }

  function allValid(results){
    return Object.keys(results).every(k => results[k]);
  }

  // Attach to window for simple reuse (minimal module pattern)
  window.PasswordPolicy = { validate, allValid, policy };
})();
