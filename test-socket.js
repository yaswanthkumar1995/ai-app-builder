const io = require('socket.io-client');

console.log('Connecting to terminal service...');

const socket = io('http://localhost:3004', {
  auth: {
    token: 'test-token',
    userId: 'test-user'
  }
});

socket.on('connect', () => {
  console.log('✅ Connected to terminal service');
  
  // Test creating a terminal
  socket.emit('create-terminal', {
    userId: 'test-user',
    projectId: 'test-project',
    userEmail: 'test@example.com'
  });
});

socket.on('terminal-created', (data) => {
  console.log('✅ Terminal created:', data);
  
  // Test sending a command
  socket.emit('terminal-input', {
    userId: 'test-user',
    input: 'echo "Hello World"\r'
  });
});

socket.on('terminal-output', (data) => {
  console.log('📤 Terminal output:', data.data);
});

socket.on('terminal-error', (error) => {
  console.error('❌ Terminal error:', error);
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected from terminal service');
});

// Exit after 10 seconds
setTimeout(() => {
  console.log('Closing connection...');
  socket.disconnect();
  process.exit(0);
}, 10000);