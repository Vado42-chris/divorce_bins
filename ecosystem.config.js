module.exports = {
    apps: [{
        name: "divorce-bins-industrial",
        script: "server.js",
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '1G',
        env: {
            NODE_ENV: "production",
            PORT: 3000
        },
        error_file: "metadata/logs/err.log",
        out_file: "metadata/logs/out.log",
        log_date_format: "YYYY-MM-DD HH:mm:ss"
    }, {
        name: "intelligence-worker",
        script: "scripts/intelligence_runner.py",
        interpreter: "python3",
        autorestart: true,
        max_memory_restart: '2G'
    }]
};
