(function(){
    'use strict';

    // Use shared PasswordPolicy if available, otherwise fallback to inline policy
    const SharedPolicy = window.PasswordPolicy || (function(){
        const p = {
            length: { test: pw => typeof pw === 'string' && pw.length >= 8, text: 'At least 8 characters' },
            uppercase: { test: pw => /[A-Z]/.test(pw), text: 'At least one uppercase letter' },
            number: { test: pw => /[0-9]/.test(pw), text: 'At least one number' },
            special: { test: pw => /[^A-Za-z0-9]/.test(pw), text: 'At least one special character (e.g. !@#$%)' }
        };
        return { policy: p, validate: pw => { const res={}; Object.keys(p).forEach(k=>res[k]=!!p[k].test(pw)); return res; }, allValid: r => Object.keys(r).every(k=>r[k]) };
    })();

    // Alert helpers: ensure a single alert is shown and placed under the policy container
    function clearAlert(){
        const prev = document.getElementById('register-alert');
        if (prev && prev.parentNode) prev.parentNode.removeChild(prev);
    }

    function showAlert(html, type='danger'){
        clearAlert();
        const alert = document.createElement('div');
        alert.id = 'register-alert';
        alert.className = `alert alert-${type}`;
        alert.setAttribute('role','alert');
        alert.innerHTML = html;
        if (policyContainer && policyContainer.parentNode) {
            if (regForm) {
                policyContainer.parentNode.insertBefore(alert, policyContainer.nextSibling);
            } else if (accForm) {
                accForm.parentNode.parentNode.prepend(alert);
            }
        } else {
            const main = document.querySelector('main');
            if (main) main.insertBefore(alert, main.firstChild);
        }
    }

    // Determine targets: registration form or account update form
    const regForm = document.getElementById('register-form');
    const accForm = document.getElementById('account-update-form');

    // For building the policy UI we prefer the primary password input from whichever form exists
    const form = regForm || accForm;
    if (!form) return;

    // Find old, primary and confirmation password inputs
    const pwOld = form.querySelector('input[type="password"][name="old_password"]') || null;
    const pwPrimary = form.querySelector('input[type="password"][name="new_password1"]') || form.querySelector('input[type="password"][name="password"]') || form.querySelector('input[type="password"]');
    const pwConfirm = form.querySelector('input[type="password"][name="new_password2"]') || null;

    // Build policy UI and insert below primary password field
    const policyContainer = document.createElement('div');
    policyContainer.className = 'password-policy mt-2';
    policyContainer.setAttribute('aria-live','polite');
    const policyIntro = document.createElement('p');
    policyIntro.className = 'small mb-1';
    policyIntro.textContent = 'Password requirements:';
    const policyList = document.createElement('ul');
    policyList.className = 'list-unstyled small mb-0';
    policyList.id = 'password-policy-list';

    // use shared policy texts
    Object.keys(SharedPolicy.policy).forEach(key => {
        const li = document.createElement('li');
        li.dataset.policy = key;
        li.className = 'text-danger';
        li.textContent = SharedPolicy.policy[key].text;
        policyList.appendChild(li);
    });

    const matchDiv = document.createElement('div');
    matchDiv.id = 'password-match';
    matchDiv.className = 'small text-danger mt-1';
    matchDiv.textContent = pwConfirm ? 'Passwords must match' : '';

    policyContainer.appendChild(policyIntro);
    policyContainer.appendChild(policyList);
    policyContainer.appendChild(matchDiv);

    if (pwPrimary && pwPrimary.parentNode) {
        pwPrimary.parentNode.insertBefore(policyContainer, pwPrimary.nextSibling);
    }

    // Validator object — use shared policy if available
    const PasswordPolicyValidator = {
        validate(password){
            return SharedPolicy.validate(password);
        },
        allValid(results){
            return SharedPolicy.allValid(results);
        },
        updateUI(results, password, confirm){
            // update list items
            const items = policyList.querySelectorAll('li');
            items.forEach(li => {
                const key = li.dataset.policy;
                if (results[key]) { li.classList.remove('text-danger'); li.classList.add('text-success'); }
                else { li.classList.remove('text-success'); li.classList.add('text-danger'); }
            });
            // update match
            if (pwConfirm) {
                if (!confirm || confirm.length === 0) {
                    matchDiv.textContent = 'Passwords must match'; matchDiv.classList.remove('text-success'); matchDiv.classList.add('text-danger');
                } else if (password === confirm) {
                    matchDiv.textContent = 'Passwords match'; matchDiv.classList.remove('text-danger'); matchDiv.classList.add('text-success');
                } else {
                    matchDiv.textContent = 'Passwords do not match'; matchDiv.classList.remove('text-success'); matchDiv.classList.add('text-danger');
                }
            }
        }
    };

    // Live validation handlers
    function handleInput(){
        const pw = pwPrimary ? pwPrimary.value : '';
        const conf = pwConfirm ? pwConfirm.value : '';
        const results = PasswordPolicyValidator.validate(pw);
        PasswordPolicyValidator.updateUI(results, pw, conf);
        return { results, pw, conf };
    }

    if (pwPrimary) pwPrimary.addEventListener('input', handleInput);
    if (pwConfirm) pwConfirm.addEventListener('input', handleInput);

    // Replace existing submit handler for registration form
    if (regForm) {
        regForm.addEventListener('submit', async function(event){
            event.preventDefault();
            clearAlert();

            const { results, pw, conf } = handleInput();
            const ok = PasswordPolicyValidator.allValid(results) && (!pwConfirm || pw === conf);
            if (!ok) {
                showAlert('Password does not meet the required policy. Please fix the items marked in red below.', 'danger');
                return;
            }

            const formData = new FormData(regForm);
            const data = {};
            formData.forEach((value, key) => { data[key] = value; });
            try {
                const response = await fetch(regForm.action, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': regForm.querySelector('input[name="csrfmiddlewaretoken"]').value
                    },
                    body: JSON.stringify(data)
                });

                if (response.ok) {
                    const msg = 'Registration successful! You will be redirected to the login page in <span id="countdown">5</span> seconds...';
                    showAlert(msg, 'success');
                    let countdown = 5;
                    const countdownElement = document.getElementById('countdown');
                    const interval = setInterval(() => {
                        countdown--;
                        if (countdownElement) countdownElement.textContent = countdown;
                        if (countdown === 0) {
                            clearInterval(interval);
                            window.location.href = '/rentals/user/login/';                            
                        }
                    }, 1000);
                } else {
                    let errorMessage = 'Registration failed. Please check your input and try again.';
                    try { const errorData = await response.json(); if (errorData.error) errorMessage = `Registration failed:\n${errorData.error}\n`; }
                    catch (e) {}
                    showAlert(`<pre>${errorMessage}</pre>`, 'danger');
                }
            } catch (error) {
                showAlert('An unexpected error occurred. Please try again later.', 'danger');
            }
        });
    }

    // Account update (profile) handler
    if (accForm) {
        accForm.addEventListener('submit', async function(e){
            e.preventDefault();
            clearAlert();

            // Basic client-side validations against model constraints
            const email = accForm.querySelector('input[name="email"]').value.trim();
            const first_name = accForm.querySelector('input[name="first_name"]').value.trim();
            const last_name = accForm.querySelector('input[name="last_name"]').value.trim();
            const phone = accForm.querySelector('input[name="phone"]').value.trim();
            const address = accForm.querySelector('input[name="address"]').value.trim();

            
            if (email && email.length > 254) { showAlert('Email is too long.', 'danger'); return; }
            if (first_name && first_name.length > 150) { showAlert('First name too long.', 'danger'); return; }
            if (last_name && last_name.length > 150) { showAlert('Last name too long.', 'danger'); return; }
            if (phone && phone.length > 15) { showAlert('Phone number too long (max 15 chars).', 'danger'); return; }
            if (address && address.length > 255) { showAlert('Address too long (max 255 chars).', 'danger'); return; }

            // If user wants to change password, ensure old password is provided and valid
            const newPwEl = accForm.querySelector('input[name="new_password1"]');
            const newPw = newPwEl ? newPwEl.value : '';
            const oldPwEl = accForm.querySelector('input[name="old_password"]');
            const oldPw = oldPwEl ? oldPwEl.value : '';
            if (newPw) {
                // verify old password by calling login API with original username (read at submit time)
                if (!oldPw) { showAlert('Please enter your current password to change to a new password.', 'danger'); return; }
                const originalUsernameInputNow = accForm.querySelector('#current-username') || accForm.querySelector('input[name="username"]');
                const originalUsernameNow = originalUsernameInputNow ? originalUsernameInputNow.value : '';
                try {
                    const verifyResp = await fetch('/rentals/api/v1/users/login/', {
                        method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({username: originalUsernameNow, password: oldPw})
                    });
                    if (!verifyResp.ok) { showAlert('Current password is incorrect.', 'danger'); return; }
                } catch (err) { showAlert('Unable to verify current password (network error).', 'danger'); return; }

                // check new password against policy
                const res = PasswordPolicyValidator.validate(newPw);
                if (!PasswordPolicyValidator.allValid(res)) { showAlert('New password does not meet policy.', 'danger'); return; }
                const confEl = accForm.querySelector('input[name="new_password2"]');
                if (confEl && newPw !== confEl.value) { showAlert('New passwords do not match.', 'danger'); return; }
            }

            // prepare payload and submit patch
            const fd = new FormData(accForm);
            const payload = {};
            fd.forEach((v,k)=>{ payload[k]=v; });

            // If changing password, map form's new_password1 to expected `password` field
            if (newPw) {
                payload.password = newPw;
                // remove form-only fields to avoid unexpected field errors
                delete payload.old_password;
                delete payload.new_password1;
                delete payload.new_password2;
            }

            try {
                const resp = await fetch(accForm.action, { 
                    method: 'PATCH', headers: {'Content-Type':'application/json', 
                    'X-CSRFToken': accForm.querySelector('input[name="csrfmiddlewaretoken"]').value,
                    'Authorization': 'Bearer ' + window.sessionStorage.getItem('access_token')},
                    body: JSON.stringify(payload) 
                });
                if (resp.ok) { showAlert('Profile updated successfully.', 'success'); return; }
                const errObj = await resp.json().catch(()=>null);
                if (errObj) {
                    showAlert(JSON.stringify(errObj), 'danger');
                    return;
                }
                showAlert('Failed to update profile.', 'danger');
            } catch (err) { showAlert('Network error while updating profile.', 'danger'); }
        });
    }

    // run initial check to set UI state
    handleInput();

})();