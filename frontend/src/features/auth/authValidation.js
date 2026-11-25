const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function readAuthForm(form, signup) {
  const fields = form.elements;
  const email = fields.email.value.trim();
  const password = fields.password.value;
  const errors = {};
  let display_name = '';

  if (signup) {
    const first = fields.first_name.value.trim();
    const last = fields.last_name.value.trim();
    display_name = first + ' ' + last;
    if (!first) errors.first_name = 'First name is required';
    if (!last) errors.last_name = 'Last name is required';
    if (first && last && display_name.length > 100) errors.last_name = 'display_name must be 100 characters or fewer';
  }

  if (!email) errors.email = 'Email address is required';
  else if (email.length > 255 || (signup ? !EMAIL_PATTERN.test(email) : fields.email.validity.typeMismatch)) {
    errors.email = 'email must be a valid email address';
  }

  if (!password) errors.password = 'Password is required';
  else if (signup) {
    if (password.length < 10) errors.password = 'password must be at least 10 characters';
    else if (password.length > 128) errors.password = 'password must be 128 characters or fewer';
    else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      errors.password = 'password must contain at least one letter and one digit';
    }
  }
  if (signup && password !== fields.confirm_password.value) errors.confirm_password = 'Your passwords do not match.';
  return { errors, credentials: { email, password }, display_name };
}

export function authFailure(error) {
  return error.status ? error.message : 'Could not reach the ProMoney server. Check that the backend is running, then try again.';
}
