module.exports = {
    apps: [{
        name: 'vault-server',
        script: 'server.js',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '500M',
        restart_delay: 3000,
        env: {
            NODE_ENV: 'production',
            PORT: 5000
        }
    }, {
        name: 'vault-frontend',
        script: 'npx',
        args: 'vite --port 3000 --host',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '500M',
        restart_delay: 3000,
        env: {
            NODE_ENV: 'production'
        }
    }]
};
