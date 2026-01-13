// Test if the password hash matches
const bcrypt = require('bcryptjs');

const password = 'En220193';
const hash = '$2a$12$bEC4obigA8U5XcXm9lnZj.DU0u.a.9MCyK6dKjGgQJsvTxZyatbia';

console.log('Testing password hash...\n');
console.log('Password:', password);
console.log('Hash:', hash);
console.log('Hash length:', hash.length);
console.log('Hash format:', hash.substring(0, 7));

bcrypt.compare(password, hash)
  .then(result => {
    console.log('\n✅ Password match:', result);
    if (!result) {
      console.log('\n❌ Hash does NOT match password!');
      console.log('Generating new hash...\n');
      return bcrypt.hash(password, 12);
    }
  })
  .then(newHash => {
    if (newHash) {
      console.log('New hash:', newHash);
      console.log('\n📝 Update database with this new hash:');
      console.log(`UPDATE users SET password = '${newHash}' WHERE email = 'enmaeladio@gmail.com';`);
    }
  })
  .catch(err => {
    console.error('Error:', err);
  });
