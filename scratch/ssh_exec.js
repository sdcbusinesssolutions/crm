const { spawn } = require('child_process');

function execSSH(cmd) {
    return new Promise((resolve, reject) => {
        const ssh = spawn('ssh', [
            '-tt', // Force pseudo-terminal allocation so password prompts are standard
            '-o', 'StrictHostKeyChecking=no',
            'root@72.61.255.20',
            cmd
        ]);

        let output = '';
        let errorOutput = '';

        const handleData = (data) => {
            const str = data.toString();
            output += str;
            process.stdout.write(str); // Print to console in real-time

            if (str.toLowerCase().includes('password:')) {
                ssh.stdin.write('Binda99@2211\n');
            }
        };

        ssh.stdout.on('data', handleData);
        ssh.stderr.on('data', handleData);

        ssh.on('close', (code) => {
            if (code === 0) {
                resolve(output);
            } else {
                reject(new Error(`SSH process exited with code ${code}.`));
            }
        });
    });
}

const commandToRun = process.argv.slice(2).join(' ') || 'docker ps && docker logs dev-cloudospire_in-whatsapp-app-8 --tail 100';
console.log(`🚀 Executing SSH Command on 72.61.255.20: "${commandToRun}"...`);

execSSH(commandToRun)
    .then(() => console.log('✅ Command complete.'))
    .catch((err) => console.error(`❌ SSH Error: ${err.message}`));
